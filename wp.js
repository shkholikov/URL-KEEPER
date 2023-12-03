useEffect(() => {
        if (state.inspections.length > 0) {
            const worker = new Worker(`${appContext.context.pageContext.site.absoluteUrl}/Configuration/statistics.worker.js`);
            if (worker) {
                worker.onmessage = (e) => {
                    console.log(e.data);
                    setState({ ...state, statisticsForVisualization: e.data, statisticsCalculated: true, dataLoaded: true });
                };

                worker.postMessage(state);

                return () => {
                    worker.terminate();
                };
            }
        }
    }, [state.inspections]);
