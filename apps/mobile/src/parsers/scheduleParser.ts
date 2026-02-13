/**
 * Vanilla JS DOM parser for FLICA schedule HTML.
 *
 * Returns a self-contained JavaScript string to inject into a WebView.
 * Uses var/function (not const/let/arrow) for maximum WebView compat.
 * This is a line-by-line translation of server/src/scraper/parser.ts
 * from cheerio to native DOM APIs.
 */

export function getScheduleParserScript(): string {
  return `
(function() {
  try {
    var MONTH_MAP = {
      JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
      JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
    };

    var MONTH_NAMES = [
      '', 'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function trim(s) { return (s || '').replace(/^\\s+|\\s+$/g, ''); }

    // ── Header parsing ──────────────────────────────────────────

    function parseHeader() {
      var h3 = document.querySelector('h3');
      var h3Text = h3 ? h3.textContent : '';

      var monthMatch = h3Text.match(/(\\w+)\\s+Schedule/);
      var monthName = monthMatch ? monthMatch[1] : '';
      var monthNumber = MONTH_NAMES.indexOf(monthName);

      var nameMatch = h3Text.match(/Schedule\\s+([\\w\\s,]+?)\\s*\\((\\d+)\\)/);
      var crewMemberName = nameMatch ? trim(nameMatch[1]) : '';
      var employeeNumber = nameMatch ? nameMatch[2] : '';

      var updatedMatch = h3Text.match(/Last Updated\\s+(.+?)$/m);
      var lastUpdated = updatedMatch ? trim(updatedMatch[1]) : '';

      var yearMatch = lastUpdated.match(/(\\d{4})/);
      var year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

      return {
        month: monthName,
        monthNumber: monthNumber,
        year: year,
        crewMemberName: crewMemberName,
        employeeNumber: employeeNumber,
        lastUpdated: lastUpdated
      };
    }

    // ── Calendar parsing ────────────────────────────────────────

    function parseCalendar() {
      var calendar = [];
      var table2 = document.getElementById('table2') || document.querySelector('table[name="table2"]');
      if (!table2) return calendar;

      var rows = table2.querySelectorAll('tr');
      for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        var cells = row.querySelectorAll('td');
        if (cells.length < 4) continue;

        var dayOfWeek = trim(cells[0].textContent);
        var dayOfMonthStr = trim(cells[1].textContent);
        var activity = trim(cells[2].textContent);
        var layoverAirport = trim(cells[3].textContent);

        if (!dayOfWeek || !dayOfMonthStr || isNaN(parseInt(dayOfMonthStr, 10))) continue;

        var dayOfMonth = parseInt(dayOfMonthStr, 10);
        var bgColor = (row.getAttribute('bgcolor') || '').toLowerCase();
        var isWeekend = bgColor === 'lightsteelblue';

        calendar.push({
          dayOfWeek: dayOfWeek,
          dayOfMonth: dayOfMonth,
          activity: activity,
          layoverAirport: layoverAirport,
          isWeekend: isWeekend
        });
      }

      return calendar;
    }

    // ── Summary parsing ─────────────────────────────────────────

    function parseSummary() {
      var block = 0, credit = 0, ytd = 0, daysOff = 0;
      var table2 = document.getElementById('table2') || document.querySelector('table[name="table2"]');
      if (!table2) return { block: block, credit: credit, ytd: ytd, daysOff: daysOff };

      var rows = table2.querySelectorAll('tr');
      for (var ri = 0; ri < rows.length; ri++) {
        var cells = rows[ri].querySelectorAll('td');
        if (cells.length >= 2) {
          var label = trim(cells[0].textContent).toLowerCase();
          var valueText = trim(cells[1].textContent);
          var value = parseFloat(valueText);

          if (label === 'block' && !isNaN(value)) block = value;
          else if (label === 'credit' && !isNaN(value)) credit = value;
          else if (label === 'ytd' && !isNaN(value)) ytd = value;
          else if (label.indexOf('days off') >= 0 && !isNaN(value)) daysOff = value;
        }
      }

      return { block: block, credit: credit, ytd: ytd, daysOff: daysOff };
    }

    // ── Duty period parsing ─────────────────────────────────────

    function parseDutyPeriods(tripTable) {
      var dutyPeriods = [];

      // Find the inner flight table (has tr.main header row)
      var innerTables = tripTable.querySelectorAll('table');
      var flightTable = null;
      for (var ti = 0; ti < innerTables.length; ti++) {
        if (innerTables[ti].querySelector('tr.main')) {
          flightTable = innerTables[ti];
          break;
        }
      }
      if (!flightTable) return dutyPeriods;

      var flightRows = flightTable.querySelectorAll('tr');
      var currentLegs = [];
      var currentLayover = null;
      var lastDayOfMonth = 0;
      var totalBlock = '';
      var totalDeadhead = '';
      var totalCredit = '';
      var totalDutyFdp = '';

      for (var fri = 0; fri < flightRows.length; fri++) {
        var row = flightRows[fri];

        // Skip header row
        if (row.classList.contains('main')) continue;

        // Check for totals row (bold)
        if (row.classList.contains('bold')) {
          var bCells = row.querySelectorAll('td');
          for (var bci = 0; bci < bCells.length; bci++) {
            var bText = trim(bCells[bci].textContent);
            if (bText === 'Total:') {
              totalBlock = trim(bCells[bci + 1] ? bCells[bci + 1].textContent : '');
              totalDeadhead = trim(bCells[bci + 2] ? bCells[bci + 2].textContent : '');
              totalCredit = trim(bCells[bci + 4] ? bCells[bci + 4].textContent : '');
              totalDutyFdp = trim(bCells[bci + 5] ? bCells[bci + 5].textContent : '');
            }
          }
          continue;
        }

        // Check for flight leg row (class="nowrap")
        if (row.classList.contains('nowrap')) {
          var cells = row.querySelectorAll('td');
          if (cells.length < 10) continue;

          var dayOfWeek = trim(cells[0].textContent);
          var dayOfMonth = parseInt(trim(cells[1].textContent), 10);
          var dhText = trim(cells[2].textContent);
          var positionCode = trim(cells[3].textContent);
          var flightNumber = trim(cells[4].textContent);
          var route = trim(cells[5].textContent);
          var departureLocal = trim(cells[6].textContent);
          var arrivalLocal = trim(cells[7].textContent);
          var blockTime = trim(cells[8].textContent);
          var groundTime = trim(cells[9].textContent);

          var routeParts = route.split('-');
          var origin = routeParts[0] || '';
          var destination = routeParts[1] || '';

          // Detect new duty period (day changed and there was a layover)
          if (currentLegs.length > 0 && dayOfMonth !== lastDayOfMonth && currentLayover) {
            dutyPeriods.push({
              legs: currentLegs,
              totalBlock: '',
              totalDeadhead: '',
              totalCredit: '',
              totalDutyFdp: '',
              layover: currentLayover
            });
            currentLegs = [];
            currentLayover = null;
          }

          lastDayOfMonth = dayOfMonth;

          // \\u00a0 is &nbsp;
          currentLegs.push({
            dayOfWeek: dayOfWeek,
            dayOfMonth: dayOfMonth,
            isDeadhead: dhText !== '' && dhText !== '\\u00a0',
            positionCode: positionCode,
            flightNumber: flightNumber,
            origin: origin,
            destination: destination,
            departureLocal: departureLocal,
            arrivalLocal: arrivalLocal,
            blockTime: blockTime,
            groundTime: groundTime
          });

          // Check for layover info in the last cell
          var lastCell = cells[cells.length - 1];
          var layoverText = trim(lastCell.textContent);
          var layoverMatch = layoverText.match(/^([A-Z]{3})\\s+(\\d{4})$/);
          if (layoverMatch) {
            currentLayover = {
              airport: layoverMatch[1],
              restTime: layoverMatch[2],
              hotelName: '',
              hotelPhone: '',
              dutyEndLocal: '',
              reportLocal: ''
            };
          }

          continue;
        }

        // Check for D-END / layover detail row
        var rowText = trim(row.textContent);
        var dendMatch = rowText.match(/D-END:\\s*(\\d{4}L?)/);
        if (dendMatch) {
          var reptMatch = rowText.match(/REPT:\\s*(\\d{4}L?)/);

          if (currentLayover) {
            currentLayover.dutyEndLocal = dendMatch[1];
            currentLayover.reportLocal = reptMatch ? reptMatch[1] : '';

            // Extract hotel info from the same row
            var dCells = row.querySelectorAll('td');
            for (var dci = 0; dci < dCells.length; dci++) {
              var dText = trim(dCells[dci].textContent);
              if (dci > 1 && dText && dText.indexOf('D-END') < 0 && dText.indexOf('T.A.F.B.') < 0) {
                if (dText.charAt(0) !== '(' && !currentLayover.hotelName) {
                  currentLayover.hotelName = dText;
                } else if (dText.charAt(0) === '(') {
                  currentLayover.hotelPhone = dText;
                }
              }
            }
          }
          continue;
        }
      }

      // Push the last duty period
      if (currentLegs.length > 0) {
        dutyPeriods.push({
          legs: currentLegs,
          totalBlock: totalBlock,
          totalDeadhead: totalDeadhead,
          totalCredit: totalCredit,
          totalDutyFdp: totalDutyFdp,
          layover: null
        });
      }

      return dutyPeriods;
    }

    // ── Trip totals parsing ─────────────────────────────────────

    function parseTripTotals(tripTable) {
      var block = '', deadhead = '', credit = '', dutyFdp = '';

      var boldRows = tripTable.querySelectorAll('tr.bold');
      if (boldRows.length === 0) return { block: block, deadhead: deadhead, credit: credit, dutyFdp: dutyFdp };

      var lastBoldRow = boldRows[boldRows.length - 1];
      var cells = lastBoldRow.querySelectorAll('td');
      for (var ci = 0; ci < cells.length; ci++) {
        var text = trim(cells[ci].textContent);
        if (text === 'Total:') {
          block = trim(cells[ci + 1] ? cells[ci + 1].textContent : '');
          deadhead = trim(cells[ci + 2] ? cells[ci + 2].textContent : '');
          credit = trim(cells[ci + 4] ? cells[ci + 4].textContent : '');
          dutyFdp = trim(cells[ci + 5] ? cells[ci + 5].textContent : '');
        }
      }

      return { block: block, deadhead: deadhead, credit: credit, dutyFdp: dutyFdp };
    }

    // ── Crew parsing ────────────────────────────────────────────

    function parseCrew(tripTable) {
      var crew = [];

      // Find the crew table (contains "Crew:" text in a <strong>)
      var innerTables = tripTable.querySelectorAll('table');
      var crewTable = null;
      for (var ti = 0; ti < innerTables.length; ti++) {
        var strongs = innerTables[ti].querySelectorAll('strong');
        for (var si = 0; si < strongs.length; si++) {
          if (strongs[si].textContent.indexOf('Crew:') >= 0) {
            crewTable = innerTables[ti];
            break;
          }
        }
        if (crewTable) break;
      }
      if (!crewTable) return crew;

      var crewRows = crewTable.querySelectorAll('tr');
      for (var cri = 0; cri < crewRows.length; cri++) {
        var cells = crewRows[cri].querySelectorAll('td');
        for (var ci = 0; ci < cells.length - 2; ci++) {
          var posText = trim(cells[ci].textContent);
          if (posText === 'CA' || posText === 'FO') {
            var empNum = trim(cells[ci + 1].textContent);
            var name = trim(cells[ci + 2].textContent);
            if (empNum && name) {
              crew.push({
                position: posText,
                employeeNumber: empNum,
                name: name
              });
            }
          }
        }
      }

      return crew;
    }

    // ── Trip parsing ────────────────────────────────────────────

    function parseTrip(table, year, monthNumber) {
      // Get direct child rows (handle tbody)
      var rows = table.querySelectorAll(':scope > tr, :scope > tbody > tr');
      if (rows.length < 2) return null;

      // First row: trip number, frequency, report time, operating dates
      var headerCells = rows[0].querySelectorAll('td');
      var tripHeaderText = trim(headerCells[0] ? headerCells[0].textContent : '');
      var tripMatch = tripHeaderText.match(/^(O\\d+)\\s*:\\s*(\\d{2}[A-Z]{3})/);
      if (!tripMatch) return null;

      var tripNumber = tripMatch[1];
      var dateStr = tripMatch[2];
      var frequency = trim(headerCells[1] ? headerCells[1].textContent : '');
      var reportTimeText = trim(headerCells[2] ? headerCells[2].textContent : '');
      var reportTimeMatch = reportTimeText.match(/BSE REPT:\\s*(\\d{4}L?)/);
      var baseReportTime = reportTimeMatch ? reportTimeMatch[1] : '';

      var operatesText = trim(headerCells[3] ? headerCells[3].textContent : '');
      var operatesMatch = operatesText.match(/Operates:\\s*(.+)/);
      var operatingDates = operatesMatch ? operatesMatch[1] : '';

      // Second row: base/equip, crew composition, exceptions
      var detailCells = rows[1].querySelectorAll('td');
      var baseEquipText = trim(detailCells[0] ? detailCells[0].textContent : '');
      var baseEquipMatch = baseEquipText.match(/Base\\/Equip:\\s*(\\w+)\\/(\\w+)/);
      var base = baseEquipMatch ? baseEquipMatch[1] : '';
      var equipment = baseEquipMatch ? baseEquipMatch[2] : '';
      var crewComposition = trim(detailCells[1] ? detailCells[1].textContent : '');

      var exceptionsText = detailCells.length > 2 ? trim(detailCells[2].textContent) : '';
      var exceptions = exceptionsText.replace(/^EXCEPT ON\\s*/i, '');

      // Parse duty periods from the inner flight table
      var dutyPeriods = parseDutyPeriods(table);

      // Extract TAFB and trip rig
      var tafb = '';
      var tripRig = '';
      var strongs = table.querySelectorAll('strong');
      for (var si = 0; si < strongs.length; si++) {
        var sText = trim(strongs[si].textContent);
        var tafbMatch = sText.match(/T\\.A\\.F\\.B\\.:\\s*(\\d+)/);
        if (tafbMatch) tafb = tafbMatch[1];
        var rigMatch = sText.match(/TRIP RIG:\\s*(\\d+)/);
        if (rigMatch) tripRig = rigMatch[1];
      }

      // Parse totals from the bold row
      var totals = parseTripTotals(table);

      // Parse crew
      var crewMembers = parseCrew(table);

      // Build date string
      var dayNum = dateStr.substring(0, 2);
      var monthAbbr = dateStr.substring(2);
      var dateMonthNum = MONTH_MAP[monthAbbr] || monthNumber;
      var dateYear = dateMonthNum < monthNumber ? year + 1 : year;
      var pad2 = function(n) { return n < 10 ? '0' + n : '' + n; };
      var date = dateYear + '-' + pad2(dateMonthNum) + '-' + dayNum;

      return {
        tripNumber: tripNumber,
        dateStr: dateStr,
        date: date,
        frequency: frequency,
        baseReportTime: baseReportTime,
        operatingDates: operatingDates,
        base: base,
        equipment: equipment,
        crewComposition: crewComposition,
        exceptions: exceptions,
        dutyPeriods: dutyPeriods,
        tafb: tafb,
        tripRig: tripRig,
        totals: totals,
        crew: crewMembers
      };
    }

    // ── Activity parsing ────────────────────────────────────────

    function parseActivity(table) {
      // Activity header: "SIC : 06FEB"
      var fontEl = table.querySelector('font');
      var headerText = fontEl ? trim(fontEl.textContent) : '';
      var match = headerText.match(/^(\\w+)\\s*:\\s*(\\d{2}[A-Z]{3})/);
      if (!match) return null;

      var type = match[1];
      var dateStr = match[2];

      var startDate = '';
      var startTime = '';
      var endDate = '';
      var endTime = '';
      var credit = '';

      // Find the data row
      var rows = table.querySelectorAll('tr');
      for (var ri = 0; ri < rows.length; ri++) {
        var cells = rows[ri].querySelectorAll('td');
        if (cells.length >= 6) {
          var firstCellText = trim(cells[0].textContent);
          if (firstCellText === type) {
            startDate = trim(cells[1].textContent);
            startTime = trim(cells[2].textContent);
            endDate = trim(cells[3].textContent);
            endTime = trim(cells[4].textContent);
            credit = trim(cells[5].textContent);
          }
        }
      }

      return {
        type: type,
        dateStr: dateStr,
        startDate: startDate,
        startTime: startTime,
        endDate: endDate,
        endTime: endTime,
        credit: credit
      };
    }

    // ── Schedule items parsing ──────────────────────────────────

    function parseScheduleItems(year, monthNumber) {
      var items = [];

      var table4 = document.querySelector('table[name="table4"]');
      if (!table4) return items;

      // Find the main cell within table4
      var mainCell = table4.querySelector(':scope > tbody > tr > td') ||
                     table4.querySelector(':scope > tr > td');
      if (!mainCell) return items;

      // Get direct child tables
      var allTables = mainCell.querySelectorAll(':scope > table');
      var i = 0;

      while (i < allTables.length) {
        var tbl = allTables[i];

        // Check if this is a header separator table (contains <hr>)
        if (tbl.getAttribute('name') === 'headertable' || tbl.querySelector('hr')) {
          i++;
          continue;
        }

        // Check if this is a trip table (has blue header with trip number pattern)
        var isTripTable = false;
        var tds = tbl.querySelectorAll('td');
        for (var tdi = 0; tdi < tds.length; tdi++) {
          var style = tds[tdi].getAttribute('style') || '';
          var text = trim(tds[tdi].textContent);
          if (style.indexOf('color: #0000ff') >= 0 && /^O\\d+\\s*:\\s*\\d{2}[A-Z]{3}/.test(text)) {
            isTripTable = true;
            break;
          }
        }

        if (isTripTable) {
          var trip = parseTrip(tbl, year, monthNumber);
          if (trip) {
            items.push({ type: 'trip', data: trip });
          }
          i++;
          continue;
        }

        // Check if this is an activity table
        var isActivityTable = false;
        var fonts = tbl.querySelectorAll('font');
        for (var fi = 0; fi < fonts.length; fi++) {
          var fText = trim(fonts[fi].textContent);
          if (/^[A-Z]{2,4}\\s*:\\s*\\d{2}[A-Z]{3}/.test(fText)) {
            isActivityTable = true;
            break;
          }
        }

        if (isActivityTable) {
          var activity = parseActivity(tbl);
          if (activity) {
            items.push({ type: 'activity', data: activity });
          }
          i++;
          continue;
        }

        i++;
      }

      return items;
    }

    // ── Main ────────────────────────────────────────────────────

    function parseScheduleDetail() {
      var header = parseHeader();
      var calendar = parseCalendar();
      var items = parseScheduleItems(header.year, header.monthNumber);
      var summary = parseSummary();

      return {
        month: header.month,
        year: header.year,
        crewMemberName: header.crewMemberName,
        employeeNumber: header.employeeNumber,
        lastUpdated: header.lastUpdated,
        calendar: calendar,
        items: items,
        summary: summary
      };
    }

    var schedule = parseScheduleDetail();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'schedule', data: schedule
    }));
  } catch (err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'parseError', error: err.message || String(err)
    }));
  }
})();
true;`;
}
