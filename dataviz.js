      // Load sqj.js module and database
      const sqlPromise = initSqlJs({
        locateFile: file => `./dist/${file}`
      });
      const dataPromise = fetch("data.db").then(res => res.arrayBuffer());
      const [SQL, buf] = await Promise.all([sqlPromise, dataPromise])
      const db = new SQL.Database(new Uint8Array(buf));

      // Grab the rundeninfo element
      const rundeninfo = document.getElementById( "rundeninfo" );
      rundeninfo.innerHTML = '<tr><th>date</th><th>loc</th></tr>';
    
      // Prepare a statement
      var stmt = db.prepare("SELECT min(date) AS F, max(date) AS T FROM Training");
      stmt.getAsObject({});
      var FromTo = stmt.getAsObject();

      var stmt = db.prepare("SELECT date AS D, location AS L, reachedPoints AS RP, totalPoints AS TP, round(((reachedPoints*1.0)/(totalPoints*1.0)*100)) AS PC FROM Training");
      var T = [];
      while(stmt.step()) {
        var Trainings = stmt.getAsObject();
        T.push({
          'start': new Date( Trainings['D'] ), 'content': Trainings['L'], 'title': Trainings['RP']+"/"+Trainings['TP']+"/"+Trainings['PC']+"%",
        });
      }

      var items = T;
  // create timeline
  var container = document.getElementById('timeline');
  var options = {
    height: '300px',
    min: new Date( FromTo['F'] ),             // lower limit of visible range
    max: new Date( FromTo['T'] ),             // upper limit of visible range
    zoomMin: 1000 * 60 * 60 * 24,             // one day in milliseconds
    zoomMax: 1000 * 60 * 60 * 24 * 31 * 3,    // about three months in milliseconds
    tooltip: { followMouse: true }
  };

  // create the timeline
  var timeline = new vis.Timeline(container);
  timeline.setOptions(options);
  timeline.setItems(items);
