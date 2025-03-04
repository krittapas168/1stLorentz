const socket = io.connect('http://127.0.0.1:8080');

window.onload = function () {
  // --- DOM Elements ---
  const baudSelect = document.getElementById('serial-baud');
  const portSelect = document.getElementById('serial-port');
  const connectBtn = document.getElementById('telemetry-connect-btn');
  const disconnectBtn = document.getElementById('telemetry-disconnect-btn');
  const statusDiv = document.getElementById('telemetry-status');

  // --- Initialize the page ---
  initializePage();

  // --- Event Listeners ---
  if (connectBtn && disconnectBtn) {
    connectBtn.addEventListener('click', handleConnect);
    disconnectBtn.addEventListener('click', handleDisconnect);
  } else {
    console.error('Connect/Disconnect buttons not found.');
  }
  portSelect.addEventListener('change', saveSelection);
  baudSelect.addEventListener('change', saveSelection);

  // --- Socket.IO Event Handlers ---
  socket.on('telemetry_status', (data) => updateTelemetryStatus(data.status));
  socket.on('receive_ports', (ports) => {
    populatePorts(ports);
    loadSelection();
  });
  socket.on('serial_connected', (status) => {
    handleConnectionStatus(true, status);
    saveConnectionStatus(true);
  });
  socket.on('serial_disconnected', (status) => {
    handleConnectionStatus(false, status);
    saveConnectionStatus(false);
  });

  socket.on('telemetry_data', (data) => {
    console.log("Telemetry data received:", data);
    updateTelemetryData(data);
    updateLidarGraph(data.timestamp, data["lidar-lite-v3"]);
    updateSpectrometerGraph(data.timestamp, data);
    updateSpectrometerVoltageGraph(data.timestamp, data);
  });

  // --- Helper Functions ---
  async function initializePage() {
    try {
      await Promise.all([populateBaudRates(), populatePortsFromServer()]);
    } catch (error) {
      console.error("Failed to initialize page:", error);
      statusDiv.textContent = "Initialization Failed. Check console.";
      statusDiv.classList.add("error");
    }
    restoreConnectionStatus();
    loadSelection();
  }

  function updateTelemetryStatus(status) {
    console.log("Status received:", status);
    statusDiv.classList.remove("connected", "disconnected", "error", "connecting", "disconnecting");
    if (status === "connected") {
      statusDiv.textContent = "Connected";
      statusDiv.classList.add("connected");
    } else if (status === "disconnected") {
      statusDiv.textContent = "Disconnected";
      statusDiv.classList.add("disconnected");
    } else if (status === "error") {
      statusDiv.textContent = "Error";
      statusDiv.classList.add("error");
    } else if (status === "connecting") {
      statusDiv.textContent = "Connecting...";
      statusDiv.classList.add("connecting");
    } else if (status === "disconnecting") {
      statusDiv.textContent = "Disconnecting...";
      statusDiv.classList.add("disconnecting");
    }
  }

  function populateBaudRates() {
    return new Promise((resolve, reject) => {
      const loadingMessage = document.createElement('option');
      loadingMessage.textContent = 'Loading...';
      baudSelect.appendChild(loadingMessage);
      fetch('/get_bauds')
        .then(response => response.json())
        .then(data => {
          baudSelect.innerHTML = '';
          const placeholderOption = document.createElement('option');
          placeholderOption.value = '';
          placeholderOption.textContent = 'Select a baud rate';
          placeholderOption.disabled = true;
          placeholderOption.selected = true;
          baudSelect.appendChild(placeholderOption);
          data.forEach(baud => {
            const option = document.createElement('option');
            option.value = baud;
            option.textContent = baud;
            baudSelect.appendChild(option);
          });
          resolve();
        })
        .catch(err => {
          console.error('Error fetching baud rates:', err);
          statusDiv.textContent = "Failed to load baud rates. Check console.";
          statusDiv.classList.add("error");
          reject(err);
        });
    });
  }

  function populatePortsFromServer() {
    return new Promise((resolve, reject) => {
      const placeholderOptionPort = document.createElement('option');
      placeholderOptionPort.value = '';
      placeholderOptionPort.textContent = 'Loading...';
      placeholderOptionPort.disabled = true;
      placeholderOptionPort.selected = true;
      portSelect.appendChild(placeholderOptionPort);
      fetch('/get_ports')
        .then(response => response.json())
        .then(ports => {
          populatePorts(ports);
          resolve();
        })
        .catch(err => {
          console.error('Error fetching ports:', err);
          statusDiv.textContent = "Failed to load ports. Check console.";
          statusDiv.classList.add("error");
          reject(err);
        });
    });
  }

  function populatePorts(ports) {
    portSelect.innerHTML = '';
    if (typeof ports === 'object' && Object.keys(ports).length > 0) {
      const placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = 'Select a port';
      placeholderOption.disabled = true;
      placeholderOption.selected = true;
      portSelect.appendChild(placeholderOption);
      Object.keys(ports).forEach(port => {
        const option = document.createElement('option');
        option.value = port;
        option.textContent = port;
        portSelect.appendChild(option);
      });
    } else {
      const noPortsOption = document.createElement('option');
      noPortsOption.value = '';
      noPortsOption.textContent = 'No ports available';
      noPortsOption.disabled = true;
      noPortsOption.selected = true;
      portSelect.appendChild(noPortsOption);
    }
  }

  function handleConnectionStatus(isConnected, status) {
    console.log(isConnected ? 'Connection status:' : 'Disconnection status:', status);
    const selects = document.querySelectorAll('.serial-form select');
    if (isConnected) {
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      selects.forEach(select => select.disabled = true);
      updateTelemetryStatus("connected");
    } else {
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      selects.forEach(select => select.disabled = false);
      updateTelemetryStatus("disconnected");
    }
  }

  function handleConnect() {
    const port = portSelect.value;
    const baud = baudSelect.value;
    if (!port || !baud) {
      statusDiv.textContent = "Please select both a port and a baud rate.";
      statusDiv.classList.add("error");
      return;
    }
    console.log('Connecting with port:', port, 'and baud rate:', baud);
    socket.emit('connect_serial', { port: port, baud: baud });
    updateTelemetryStatus("connecting");
  }

  function handleDisconnect() {
    console.log('Disconnecting serial connection');
    socket.emit('disconnect_serial');
    updateTelemetryStatus("disconnecting");
  }

  function saveSelection() {
    const selectedPort = portSelect.value;
    const selectedBaud = baudSelect.value;
    if (selectedPort && selectedBaud) {
      sessionStorage.setItem('selectedPort', selectedPort);
      sessionStorage.setItem('selectedBaud', selectedBaud);
    }
  }

  function loadSelection() {
    const savedPort = sessionStorage.getItem('selectedPort');
    const savedBaud = sessionStorage.getItem('selectedBaud');
    if (savedPort && portSelect.querySelector(`option[value="${savedPort}"]`)) {
      portSelect.value = savedPort;
    }
    if (savedBaud && baudSelect.querySelector(`option[value="${savedBaud}"]`)) {
      baudSelect.value = savedBaud;
    }
  }

  function saveConnectionStatus(isConnected) {
    sessionStorage.setItem('isConnected', isConnected);
  }

  function restoreConnectionStatus() {
    const isConnected = sessionStorage.getItem('isConnected') === 'true';
    if (isConnected) {
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;
      const selects = document.querySelectorAll('.serial-form select');
      selects.forEach(select => select.disabled = true);
      updateTelemetryStatus("connected");
    } else {
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
      const selects = document.querySelectorAll('.serial-form select');
      selects.forEach(select => select.disabled = false);
      updateTelemetryStatus("disconnected");
    }
  }

  // --- Telemetry Config (for UI status classes) ---
  const telemetryConfig = {
    "timestamp": { unit: '', ranges: { normal: [0, 10], warning: [10, 15], critical: [15, Infinity] } },
    "packet-counter": { unit: '', ranges: { normal: [0, Infinity], warning: [5000, 7500], critical: [7500, 10000] } },
    "lidar-lite-v3": { unit: 'cm', ranges: { normal: [0, Infinity], warning: [200, 500], critical: [500, 1000] } },
    "spectrometer-voltage": { unit: 'V', ranges: { normal: [0, Infinity], warning: [3, 6], critical: [6, 10] } },
    "latitude": { unit: '°', ranges: { normal: [-45, Infinity], warning: [45, 70], critical: [70, 90] } },
    "longitude": { unit: '°', ranges: { normal: [-90, Infinity], warning: [90, 135], critical: [135, 180] } },
    "altitude": { unit: 'm', ranges: { normal: [0, Infinity], warning: [1000, 5000], critical: [5000, 10000] } },
    "accelerometer-x": { unit: 'm/s²', ranges: { normal: [-10, Infinity], warning: [10, 20], critical: [20, 100] } },
    "accelerometer-y": { unit: 'm/s²', ranges: { normal: [-10, Infinity], warning: [10, 20], critical: [20, 100] } },
    "accelerometer-z": { unit: 'm/s²', ranges: { normal: [-10, Infinity], warning: [10, 20], critical: [20, 100] } }
  };

  // Determine a status class based on telemetry value
  function getStatusClass(value, key) {
    if (!(key in telemetryConfig)) return 'normal';
    const { normal, warning, critical } = telemetryConfig[key].ranges;
    if (value === undefined || value === null || isNaN(value)) return 'normal';
    if (value >= normal[0] && value <= normal[1]) return 'normal';
    if (value > warning[0] && value <= warning[1]) return 'warning';
    if (value > critical[0] && value <= critical[1]) return 'critical';
    return 'normal';
  }

  // Update telemetry data displayed in the UI
  function updateTelemetryData(data) {
    Object.keys(telemetryConfig).forEach(key => {
      const element = document.getElementById(key);
      if (!element) {
        console.warn(`Element with ID "${key}" not found.`);
        return;
      }

      let value = data[key] ?? "N/A";
      const unit = telemetryConfig[key].unit;

      // Format timestamp to show only time
      if (key === "timestamp" && value !== "N/A") {
        const dateObj = new Date(value);
        if (!isNaN(dateObj)) {
          value = dateObj.toLocaleTimeString("en-GB"); // HH:MM:SS format
        }
      }

      element.innerHTML = `${value} <span class='data-unit'>${unit}</span>`;
      const statusClass = getStatusClass(value, key);
      element.classList.remove('normal', 'warning', 'critical');
      element.classList.add(statusClass);
    });
  }

  const lidarGraphDiv = document.getElementById('lidar-lite-v3-graph');
  const maxDataPoints = 100;
  let lidarData = {
    x: [], // Elapsed time (index-based for smooth plotting)
    y: [], // Distance values
    timestamps: [], // Store actual timestamps for tooltip display
    startTime: null,
    trace: {
      x: [],
      y: [],
      mode: 'lines+markers',
      name: 'Lidar Lite V3 Distance',
      line: { color: '#80CAF6' },
      text: [], // Text for tooltip
      hoverinfo: 'text' // Display text on hover
    },
    layout: {
      title: 'Lidar-Lite-V3',
      xaxis: { title: 'Time (seconds)' },
      yaxis: { title: 'Distance (cm)' },
      margin: { t: 50, b: 70, l: 70, r: 50 },
      font: { family: "Rubik, sans-serif" },
      showlegend: false
    },
    config: { responsive: true }
  };

  Plotly.newPlot(lidarGraphDiv, [lidarData.trace], lidarData.layout, lidarData.config);

  function updateLidarGraph(timestamp, distance) {
    if (!timestamp || distance === undefined) return;

    let time = new Date(timestamp);
    if (isNaN(time.getTime())) {
      console.error("Invalid timestamp:", timestamp);
      return;
    }

    if (lidarData.startTime === null) {
      lidarData.startTime = time;
    }

    let elapsedTime = (time - lidarData.startTime) / 1000;

    lidarData.x.push(elapsedTime);
    lidarData.y.push(distance);
    lidarData.timestamps.push(time.toLocaleTimeString("en-GB")); // Store formatted timestamp

    if (lidarData.x.length > maxDataPoints) {
      lidarData.x.shift();
      lidarData.y.shift();
      lidarData.timestamps.shift();
    }

    // Update trace with text tooltip
    lidarData.trace.x = [...lidarData.x];
    lidarData.trace.y = [...lidarData.y];
    lidarData.trace.text = lidarData.timestamps.map((t, i) => `Time: ${t}<br>Distance: ${lidarData.y[i]} cm`);

    Plotly.react(lidarGraphDiv, [lidarData.trace], lidarData.layout);
  }

  const spectrometerGraphDiv = document.getElementById('spectrometer-graph');
  const maxSpectrometerDataPoints = 100;

  let spectrometerData = {
    traces: {},  // Store spectrometer traces dynamically
    layout: {
      title: 'C12880MA',
      xaxis: { title: 'Time (seconds)' },
      yaxis: { title: 'Wavelength (nm)' },
      margin: { t: 50, b: 70, l: 70, r: 50 },
      font: { family: "Rubik, sans-serif" },
      showlegend: true
    },
    config: { responsive: true },
    startTime: null
  };

  function updateSpectrometerGraph(timestamp, telemetryData) {
    if (!timestamp || !telemetryData.spectrometer) return;

    let time = new Date(timestamp);
    if (isNaN(time.getTime())) {
      console.error("Invalid timestamp:", timestamp);
      return;
    }

    if (spectrometerData.startTime === null) {
      spectrometerData.startTime = time;
    }

    let elapsedTime = (time - spectrometerData.startTime) / 1000;
    let spectrometerValues = telemetryData.spectrometer;

    Object.keys(spectrometerValues).forEach((key) => {
      let voltage = spectrometerValues[key];

      if (!spectrometerData.traces[key]) {
        spectrometerData.traces[key] = {
          x: [],
          y: [],
          timestamps: [],
          trace: {
            x: [],
            y: [],
            mode: 'lines+markers',
            name: key,
            line: { width: 2 },
            text: [],
            hoverinfo: 'text'
          }
        };
      }

      let trace = spectrometerData.traces[key];
      trace.x.push(elapsedTime);
      trace.y.push(voltage);
      trace.timestamps.push(time.toLocaleTimeString("en-GB"));

      if (trace.x.length > maxSpectrometerDataPoints) {
        trace.x.shift();
        trace.y.shift();
        trace.timestamps.shift();
      }

      trace.trace.x = [...trace.x];
      trace.trace.y = [...trace.y];
      trace.trace.text = trace.timestamps.map((t, i) => `Time: ${t}<br>Voltage: ${trace.y[i]} V`);
    });

    let tracesArray = Object.values(spectrometerData.traces).map(data => data.trace);
    Plotly.react(spectrometerGraphDiv, tracesArray, spectrometerData.layout, spectrometerData.config);
  }

  // Initialize the empty plot
  Plotly.newPlot(spectrometerGraphDiv, [], spectrometerData.layout, spectrometerData.config);

  const spectrometerVoltageGraphDiv = document.getElementById('spectrometer-voltage-graph');
  const maxSpectrometerVoltageDataPoints = 100;
  
  let spectrometerVoltageData = {
      x: [],
      y: [],
      layout: {
          title: 'Spectrometer Voltage',
          xaxis: { title: 'Time (seconds)' },
          yaxis: { title: 'Voltage (V)' },
          margin: { t: 50, b: 70, l: 70, r: 50 },
          font: { family: "Rubik, sans-serif" }
      },
      config: { responsive: true },
      startTime: null
  };
  
  function updateSpectrometerVoltageGraph(timestamp, telemetryData) {
      if (!timestamp || !telemetryData['spectrometer-voltage']) return;
  
      let time = new Date(timestamp);
      if (isNaN(time.getTime())) {
          console.error("Invalid timestamp:", timestamp);
          return;
      }
  
      if (spectrometerVoltageData.startTime === null) {
          spectrometerVoltageData.startTime = time;
      }
  
      let elapsedTime = (time - spectrometerVoltageData.startTime) / 1000;
      let voltage = telemetryData['spectrometer-voltage'];
  
      spectrometerVoltageData.x.push(elapsedTime);
      spectrometerVoltageData.y.push(voltage);
  
      if (spectrometerVoltageData.x.length > maxSpectrometerVoltageDataPoints) {
          spectrometerVoltageData.x.shift();
          spectrometerVoltageData.y.shift();
      }
  
      Plotly.react(spectrometerVoltageGraphDiv, [{
          x: spectrometerVoltageData.x,
          y: spectrometerVoltageData.y,
          mode: 'lines+markers',
          name: 'Spectrometer Voltage',
          line: { width: 2 },
          text: spectrometerVoltageData.x.map((t, i) => `Time: ${t}s<br>Voltage: ${spectrometerVoltageData.y[i]} V`),
          hoverinfo: 'text'
      }], spectrometerVoltageData.layout, spectrometerVoltageData.config);
  }
  
  // Initialize the empty plot
  Plotly.newPlot(spectrometerVoltageGraphDiv, [], spectrometerVoltageData.layout, spectrometerVoltageData.config);
  
  // Example telemetry event handler
  socket.on('telemetry_data', (data) => {
      updateSpectrometerVoltageGraph(data.timestamp, data);
  });
};