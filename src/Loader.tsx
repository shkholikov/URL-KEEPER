import React from "react";
import ContentLoader from "react-content-loader";

const Loader = () => {
  return (
    <ContentLoader viewBox="0 0 400 150">
      {/*1*/}
      <rect x="0" y="20" rx="3" ry="3" width="100" height="10" />
      <rect x="105" y="20" rx="3" ry="3" width="100" height="10" />
      <rect x="210" y="20" rx="3" ry="3" width="50" height="10" />
      {/*2*/}
      <rect x="45" y="40" rx="3" ry="3" width="100" height="10" />
      <rect x="150" y="40" rx="3" ry="3" width="80" height="10" />
      {/*3*/}
      <rect x="0" y="60" rx="3" ry="3" width="260" height="10" />
      {/*4*/}
      <rect x="0" y="80" rx="3" ry="3" width="260" height="10" />
      {/*5*/}
      <rect x="0" y="100" rx="3" ry="3" width="100" height="10" />
      <rect x="105" y="100" rx="3" ry="3" width="100" height="10" />
      <rect x="210" y="100" rx="3" ry="3" width="50" height="10" />
      {/*6*/}
      <rect x="0" y="120" rx="3" ry="3" width="260" height="10" />
      {/*7*/}
      <rect x="0" y="140" rx="3" ry="3" width="125" height="10" />
      <rect x="135" y="140" rx="3" ry="3" width="125" height="10" />
    </ContentLoader>
  );
};

export default Loader;
