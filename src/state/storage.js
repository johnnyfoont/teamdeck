// Persistence adapter for the legacy vanilla app.
window.TeamdeckStorage={dataKey:'hireos-data',loadData(){return localStorage.getItem(this.dataKey)},saveData(data){localStorage.setItem(this.dataKey,JSON.stringify(data))}};
