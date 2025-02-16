# README MyTargets-DataViz

View/analyze your MyTargets Backupdata in the Browser - only Chrome working/tested
Needs "data.db" backup file in the webserver directory, remote or local (ex.: $ python -m http.server &)

## Working
- Show timeline of trainings with navigation menu
- Show graph of trainings/results
- Show Round-Info and Round-Graph for visible or selected trainings
- Filters: synchronize display after change (Location/Distance/Bow/)
- Show Passe results and graphic

## ToDos
This is a hobbyist tool intended for personal use, there may or may not be further development
Do what you like with it, but do the right thing..

### General
- Design (Material/..?)
- Load data from Google Drive?
- Internationalization

### Graphs
- Function: showTrefferBild - display needs fix
- Statistics with filtering (Location/Distance/Bow/Arrow/..?)
- Shot visualizations

## Known Problems
- Positioning of DIVs/CANVASes via CSS
- Handling of window for Passe-display (re-opening/scrollbars)
- use of momentjs [https://github.com/you-dont-need/You-Dont-Need-Momentjs]

## Credits
- https://almende.github.io/vis/ timeline - A dynamic, browser based visualization library
- https://www.chartjs.org/ - JavaScript charting library
- https://github.com/sql-js/sql.js - A javascript library to run SQLite on the web
- https://momentjs.com/ - use dates and times in JavaScript

## License
This project is licensed under the terms of the MIT license
