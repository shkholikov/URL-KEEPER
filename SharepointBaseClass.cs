using System;
using System.Collections.Generic;
using System.Configuration;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security;
using Microsoft.Identity.Client;
using Microsoft.SharePoint.Client;
using static Commerzbank.EtSquare.Import.Extensions;

using File = Microsoft.SharePoint.Client.File;
using WebProxy = System.Net.WebProxy;

namespace Commerzbank.EtSquare.Import
{
    public class SharepointBaseClass : BulkBaseClass
    {
        // ReSharper disable MemberCanBePrivate.Global
        protected const string USER_INFORMATION_LIST = "User Information List";
        private const string DEFAULT_VIEW = "<View></View>";
        protected ClientContext SpContext { get; set; }
        private ListCollection SpLists { get; set; }

        private Site SpSite { get; set; }
        private Web SpWeb { get; set; }

        protected static string GetUser(ListItem item, string field, IReadOnlyDictionary<int, string> users)
        {
            var lookupId = ((FieldLookupValue) item[field])?.LookupId ?? 0;
            return lookupId != 0 && users.ContainsKey(lookupId)
                ? users[lookupId]
                : string.Empty;
        }

        protected void EnumData(IEnumerable<EtSquareBaseClass> entries, string url, string list, string field,
            string name)
        {
            var step = string.Empty;
            foreach (var entry in entries.Where(static b => b.HasContact).ToList())
            {
                if (!string.IsNullOrWhiteSpace(entry.RefNr.Replace("\"", string.Empty)))
                {
                    try
                    {
                        step = $"1. UpdateSharepointItem:{entry.ItemId}";
                        UpdateSharepointItem(entry.ItemId,
                            new Dictionary<string, object> { { field, entry.RefNr } }, list, false);
                    }
                    catch (Exception ex)
                    {
                        SendErrorMail(
                            $"{MethodBase.GetCurrentMethod()?.Name} - {step}:\t{ex.Message}\n\tId: {entry.ItemId}\n\tRefNr: {entry.RefNr}",
                            name);
                    }

                    continue;
                }


                try
                {
                    if (entry.HasAttachments)
                    {
                        step = $"GetAttachments:{entry.ItemId}";
                        entry.Attachments = GetAttachments($"{url}/Attachments/{entry.ItemId}");
                    }
                }
                catch (Exception ex)
                {
                    SendErrorMail(
                        $"{MethodBase.GetCurrentMethod()?.Name} - {step}:\t{ex.Message}\n\tId: {entry.ItemId}\n\tRefNr: {entry.RefNr}",
                        name);
                }

                try
                {
                    step = $"CreateTicket:{entry.ItemId}";
                    entry.CreateTicket();

                    if (string.IsNullOrWhiteSpace(entry.RefNr))
                    {
                        entry.RefNr = "NN";
                        continue;
                    }
                    step = $"2. UpdateSharepointItem:{entry.ItemId}";
                    UpdateSharepointItem(entry.ItemId,
                        new Dictionary<string, object> {{field, entry.RefNr}}, list, false);
                    //Execute two times, because Sharepoint often did not update on first try
                    step = $"3. UpdateSharepointItem:{entry.ItemId}";
                    UpdateSharepointItem(entry.ItemId,
                        new Dictionary<string, object> {{field, entry.RefNr}}, list, true);
                }
                catch (Exception ex)
                {
                    SendErrorMail(
                        $"{MethodBase.GetCurrentMethod()?.Name} - {step}:\t{ex.Message}\n\tId: {entry.ItemId}\n\tRefNr: {entry.RefNr}",
                        name);
                }
            }
        }

        protected Dictionary<string, byte[]> GetAttachments(string url)
        {
            var folder = SpWeb.GetFolderByServerRelativeUrl(url);
            SpContext.Load(folder);
            SpContext.ExecuteQuery();
            var attachments = folder.Files;
            SpContext.Load(attachments);
            SpContext.ExecuteQuery();
            var ret = attachments.Select(LoadFile)
                .ToDictionary(static f => f.Key, static f => f.Value);
            return ret;
        }

        protected ListItemCollection GetItems(string title, string viewXml = DEFAULT_VIEW)
        {
            try
            {
                var list = SpLists.GetByTitle(title);
                var items = list.GetItems(new CamlQuery {ViewXml = viewXml});
                SpContext.Load(items);
                SpContext.ExecuteQuery();
                return items;
            }
            catch (Exception)
            {
                return null;
            }
        }


        protected Dictionary<int, string> GetUsersList()
        {
            var step = string.Empty;
            try
            {
                step = "GetItems";
                var items = GetItems(USER_INFORMATION_LIST) ?? GetItems("Benutzerinformationsliste");
                step = "return";
                return items
                    .Where(static i => i["UserName"] != null && !string.IsNullOrWhiteSpace(i["UserName"].ToString()))
                    .ToDictionary(static i => i.Id, static i => i["UserName"].ToString());
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                throw new ApplicationException($"GetUsersList - {step}: {ex.Message}\n{ex.InnerException?.Message}");
            }

        }

        // ReSharper disable once MemberCanBePrivate.Global
        protected static void InitSpm()
        {
            ServicePointManager.ServerCertificateValidationCallback = static delegate { return true; };
            ServicePointManager.SecurityProtocol =
                SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
        }

        protected void InitSp(string url, string name)
        {
            InitSpm();
            try
            {
                if (url.Contains(ConfigurationManager.AppSettings["SharepointOnline"]))
                {
                    var user = $"{ConfigurationManager.AppSettings["TecUser"]}@ztb.icb.commerzbank.com";
                    var secureString = new SecureString();
                    ConfigurationManager.AppSettings["TecPwd"].ToList().ForEach(secureString.AppendChar);


                    WebRequest.DefaultWebProxy = new WebProxy(ConfigurationManager.AppSettings["AzureProxy"],
                        true,
                        Array.Empty<string>(),
                        new NetworkCredential(
                            ConfigurationManager.AppSettings["TecUser"],
                            ConfigurationManager.AppSettings["TecPwd"],
                            ConfigurationManager.AppSettings["TecDomain"])
                    );

                    var auth = new PnP.Framework.AuthenticationManager(user, secureString);
                    SpContext = auth.GetContext(url);
                }
                else
                {
                    SpContext = new ClientContext(url) {RequestTimeout = -1};
                }
            }
            catch (Exception ex)
            {
                SendErrorMail($"{MethodBase.GetCurrentMethod()?.Name}:\t{ex.Message}\n\t{ex.InnerException?.Message}",
                    name);
                return;
            }

            GetSiteCollection();
            GetWeb();
            GetLists();
        }

        // ReSharper disable once UnusedMember.Local
        private AuthenticationResult GetToken()
        {
            var tenant = ConfigurationManager.AppSettings["tenantId"];
            var cca = ConfidentialClientApplicationBuilder
                .Create(ConfigurationManager.AppSettings["appId"])
                .WithClientSecret(ConfigurationManager.AppSettings["clientSecret"])
                .WithTenantId(tenant)
                .WithHttpClientFactory(new MsalHttpClient())
                .Build();
            var authResult = cca.AcquireTokenForClient(new[] {"https://commerzbank.sharepoint.com/.default"})
                // .WithTenantId(specificTenant)
                // See https://aka.ms/msal.net/withTenantId
                .ExecuteAsync();
            authResult.Wait();

            return authResult.Result;
        }

        protected async void UpdateSharepointItem(int id, Dictionary<string, object> fieldValues, string title,
            bool asynchron)
        {
            try
            {
                var list = SpLists.GetByTitle(title);
                var item = list.GetItemById(id);
                foreach (var fieldValue in fieldValues)
                {
                    item[fieldValue.Key] = fieldValue.Value;
                }

                item.Update();
                if (asynchron)
                {
                    await SpContext.ExecuteQueryAsync();
                }
                else
                {
                    // ReSharper disable once MethodHasAsyncOverload
                    SpContext.ExecuteQuery();
                }
            }
            catch (Exception ex)
            {
                Debug.Print(ex.Message);
            }
        }

        private KeyValuePair<string, byte[]> LoadFile(File file)
        {
            try
            {
                var streamX = file.OpenBinaryStream();
                SpContext.ExecuteQuery();
                var stream = streamX.Value;
                var bytes = new byte[stream.Length];
                _ = stream.Read(bytes, 0, (int) stream.Length);
                return new KeyValuePair<string, byte[]>(file.Name, bytes);
            }
            catch (Exception e)
            {
                Debug.Print(e.Message);
                return new KeyValuePair<string, byte[]>();
            }
        }

        // ReSharper disable once MemberCanBePrivate.Global
        protected void GetLists()
        {
            SpLists = SpWeb.Lists;
            SpContext.Load(SpLists);
            SpContext.ExecuteQuery();
            foreach (var list in SpLists)
            {
                Debug.Print(list.Title);
            }
        }

        // ReSharper disable once MemberCanBePrivate.Global
        protected void GetSiteCollection()
        {
            SpSite = SpContext.Site;
            SpContext.Load(SpSite);
            SpContext.ExecuteQuery();
        }

        // ReSharper disable once MemberCanBePrivate.Global
        protected void GetWeb()
        {
            SpWeb = SpContext.Web;
            SpContext.Load(SpWeb);
            SpContext.ExecuteQuery();
        }
    }

    public class MsalHttpClient : IMsalHttpClientFactory
    {
        private static readonly HttpClient HttpClient;

        static MsalHttpClient()
        {
            var proxyUrl = ConfigurationManager.AppSettings["AzureProxy"];
            var proxy = string.IsNullOrEmpty(proxyUrl)
                ? null
                : new WebProxy(proxyUrl,
                    true,
                    Array.Empty<string>(),
                    new NetworkCredential(ConfigurationManager.AppSettings["TecUser"],
                        ConfigurationManager.AppSettings["TecPwd"], ConfigurationManager.AppSettings["TecDomain"]));


            var proxyHttpClientHandler = new HttpClientHandler
            {
                Proxy = proxy,
                UseProxy = true,
                AllowAutoRedirect = true
            };

            HttpClient = new HttpClient(proxyHttpClientHandler);
        }

        public HttpClient GetHttpClient() => HttpClient;
    }
}
