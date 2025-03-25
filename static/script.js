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
    updateAccelerometerGraph(data.timestamp, data)
    updateVelocityGraph(data.timestamp, data)

    updatePosition(data.longitude, data.latitude);

    if (data.timestamp) {
      if (!firstTimestamp) {
        firstTimestamp = data.timestamp;
        sessionStorage.setItem("firstTimestamp", firstTimestamp);
        document.getElementById('start-time').textContent = new Date(firstTimestamp * 1000).toLocaleTimeString();
        document.getElementById('start-time').classList.add('start-time-color');
        // Don't call startTimer() here - wait for user to click Start
      }
      
      lastTelemetryTimestamp = data.timestamp;
    }
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

  function resetConnection() {
    fetch('/reset_connection')
      .then(response => response.json())
      .then(data => {
        const statusDiv = document.getElementById('telemetry-status');

        if (data.status === "success") {
          statusDiv.classList.add("success");
        } else {
          statusDiv.classList.add("error")
          statusDiv.textContent = "Error: " + data.message;
        }
      })
      .catch(error => {
        const statusDiv = document.getElementById('telemetry-status');
        statusDiv.textContent = "Error: Failed to reset connection";
      });
  }

  document.getElementById('telemetry-status').addEventListener('click', resetConnection);

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
    "timestamp": { unit: '', ranges: { normal: [0, Infinity] } },

    "packet-counter": { unit: '', ranges: { normal: [0, Infinity], critical: [-1, Infinity] } },

    "lidar-lite-v3": { unit: 'cm', ranges: { normal: [0, 4000], warning: [100, 300], critical: [300, 500] } },

    "spectrometer-voltage": { unit: 'V', ranges: { normal: [0, 5], warning: [3, 4], critical: [4, 5] } },

    "spectrometer-water-detect": { unit: '', ranges: { normal: [1], warning: [0], critical: [2, Infinity] } },

    "latitude": { unit: '°', ranges: { normal: [-90, 90], warning: [30, 60], critical: [60, 90] } },
    "longitude": { unit: '°', ranges: { normal: [-180, 180], warning: [60, 120], critical: [120, 180] } },
    "altitude": { unit: 'm', ranges: { normal: [0, 5000], warning: [500, 3000], critical: [3000, 6000] } },

    "accelerometer": { unit: 'm/s²', ranges: { normal: [-5, 5], warning: [5, 10], critical: [10, 20] } },

    "velocity": { unit: 'm/s', ranges: { normal: [-5, 5], warning: [5, 10], critical: [10, 20] } }
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

      // Handle timestamp conversion to human-readable format
      if (key === "timestamp" && value !== "N/A") {
        // Assuming value is a Unix timestamp (in seconds)
        const dateObj = new Date(value * 1000); // Convert from seconds to milliseconds

        // Format to human-readable date (can be customized)
        const humanReadableTime = dateObj.toLocaleString(); // or dateObj.toUTCString()
        value = humanReadableTime;  // Update value with formatted time
      }

      // Display value and unit
      element.innerHTML = `${value} <span class='data-unit'>${unit}</span>`;

      // Update the element's status class based on value
      const statusClass = getStatusClass(value, key);
      element.classList.remove('normal', 'warning', 'critical');
      element.classList.add(statusClass);
    });
  }

  // ########################################################################

  // MAP
  //CESIUM

  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjYzQwMDViYS0zMWQ4LTRmZWYtOWY1My1mNWRmZjYxNGQ1OTEiLCJpZCI6Mjc2MDgwLCJpYXQiOjE3NDE5ODAwOTV9.rkumv2e5u-oSfMCpeByJlZA96ZHgXZiNhTehHPJU4W0';

  // Home position (initial position)
  let homelat = 12.97556;
  let homelon = 101.45611;

  // Initialize Cesium Viewer
  const viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    timeline: false,
    terrainProvider: Cesium.createWorldTerrain(),
    sceneMode: Cesium.SceneMode.SCENE3D,
    homeButton: true,
  });

  // Initialize Leaflet Map
  const tileLayer = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', { attribution: false });
  const map = L.map('leafletMap', {
    zoomControl: true,
    layers: [tileLayer],
    maxZoom: 18,
    minZoom: 6,
  }).setView([homelat, homelon], 16);

  // Ensure the map size is updated
  setTimeout(() => { map.invalidateSize(); }, 800);

  // Variables to track positions and entities
  let positions = []; // Stores historical positions for path tracing
  let entity = viewer.entities.add({
    id: "Rover",
    position: Cesium.Cartesian3.fromDegrees(homelon, homelat, 1000), // Initial home position
    point: {
      pixelSize: 10,
      color: Cesium.Color.RED, // Use a red dot as the marker
    },
  });

  // Create the Leaflet marker (using a default marker)
  let leafletMarker = L.marker([homelat, homelon]).addTo(map);

  // Flag to check if the first data point has been received
  let isFirstDataPoint = true;

  // Function to update position in both Cesium and Leaflet
  function updatePosition(lon, lat) {
    // Validate coordinates
    if (isNaN(lon) || isNaN(lat)) {
      console.error('Invalid coordinates received:', { lon, lat });
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.error('Out of bounds coordinates received:', { lon, lat });
      return;
    }

    // --- Update Cesium Position ---
    const newPosition = Cesium.Cartesian3.fromDegrees(lon, lat, 70
    );

    // Update the vehicle entity position
    entity.position = newPosition;

    // If this is the first data point, reset the path and start tracing
    if (isFirstDataPoint) {
      positions = []; // Reset the path
      isFirstDataPoint = false; // Mark that the first data point has been received

      // Fly to the first data point with a reasonable height
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1000), // Set a fixed height (1000 meters)
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-90), // Slight tilt for better view
          roll: 0,
        },
        duration: 2, // Fly-to duration in seconds
      });
    }

    // Store the position for the path
    positions.push(newPosition);

    // Update the rover path in Cesium
    viewer.entities.removeById('roverPath');
    viewer.entities.add({
      id: 'roverPath',
      polyline: {
        positions: positions,
        width: 2,
        material: Cesium.Color.YELLOW,
      },
    });

    // --- Update Leaflet Position ---
    leafletMarker.setLatLng([lat, lon]); // Update the existing marker's position
    map.setView([lat, lon]); // Re-center Leaflet map to the new position
  }

  function generateLidarData() {
    const timestamp = Date.now(); // current time in milliseconds
    const distance = Math.floor(Math.random() * 400); // Random distance between 0 and 400 cm
    return { timestamp, distance };
  }

  // ########################
  const lidarGraphDiv = document.getElementById('lidar-lite-v3-graph');
  let lidarData = {
    x: [],
    y: [],
    timestamps: [],
    startTime: null,
    trace: {
      x: [],
      y: [],
      mode: 'lines+markers',
      name: 'Lidar Lite V3 Distance',
      line: { color: '#80CAF6' },
      text: [],
      hoverinfo: 'text'
    },
    layout: {
      title: {
        text: 'Lidar-Lite-V3',
        font: { family: "Rubik, sans-serif" }
      },
      xaxis: { title: 'Time (seconds)', range: [0, 10] },
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

    let time = unixToHumanReadable(timestamp);  // Use the conversion function

    if (lidarData.startTime === null) {
      lidarData.startTime = new Date(time);
    }

    let elapsedTime = (new Date(time) - lidarData.startTime) / 1000;

    lidarData.x.push(elapsedTime);
    lidarData.y.push(distance);

    let minX = Math.max(0, elapsedTime - 10);
    let maxX = minX + 10;
    lidarData.layout.xaxis.range = [minX, maxX];

    lidarData.trace.x = lidarData.x;
    lidarData.trace.y = lidarData.y;

    lidarData.trace.text = lidarData.x.map((t, i) => {
      let formattedTime = new Date(lidarData.startTime.getTime() + t * 1000).toLocaleTimeString("en-GB");
      return `Time: ${formattedTime}<br>Distance: ${lidarData.y[i]} cm`;
    });

    Plotly.react(lidarGraphDiv, [lidarData.trace], lidarData.layout, lidarData.config);
  }

  function unixToHumanReadable(unixTimestamp) {
    const dateObj = new Date(unixTimestamp * 1000);  // Convert from seconds to milliseconds
    return dateObj.toLocaleString();  // Converts to a human-readable date/time string
  }

  const spectrometerGraphDiv = document.getElementById('spectrometer-graph');
  let spectrometerData = {
    traces: {},
    layout: {
      title: 'Spectrometer',
      xaxis: { title: 'Time (seconds)', range: [0, 10] },
      yaxis: { title: 'Wavelength (nm)' },
      margin: { t: 50, b: 70, l: 70, r: 50 },
      pad: 40,
      font: { family: "Rubik, sans-serif" },
      showlegend: true,
      annotations: [] 
    },
    config: { responsive: true },
    startTime: null
  };

  function updateSpectrometerGraph(timestamp, telemetryData) {
    if (!timestamp || !telemetryData.spectrometer || telemetryData['spectrometer-voltage'] === undefined) return;

    let time = unixToHumanReadable(timestamp);  // Use the conversion function

    if (spectrometerData.startTime === null) {
      spectrometerData.startTime = new Date(time);
    }

    let elapsedTime = (new Date(time) - spectrometerData.startTime) / 1000;
    let spectrometerValues = telemetryData.spectrometer;
    let spectrometerVoltage = telemetryData['spectrometer-voltage'];

    Object.keys(spectrometerValues).forEach((key) => {
      let wavelength = spectrometerValues[key];

      if (!spectrometerData.traces[key]) {
        spectrometerData.traces[key] = {
          x: [],
          y: [],
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
      trace.y.push(wavelength);

      let minX = Math.max(0, elapsedTime - 10);
      let maxX = minX + 10;
      spectrometerData.layout.xaxis.range = [minX, maxX];

      trace.trace.x = trace.x;
      trace.trace.y = trace.y;

      trace.trace.text = trace.x.map((t, i) => {
        let formattedTime = new Date(spectrometerData.startTime.getTime() + t * 1000).toLocaleTimeString("en-GB");
        return `Time: ${formattedTime}<br>Wavelength: ${trace.y[i]} nm<br>Voltage: ${spectrometerVoltage} V`;
      });
    });

    spectrometerData.layout.annotations = [
      {
        xref: 'paper',
        yref: 'paper',
        x: 1,
        y: 1.1,
        xanchor: 'right',
        yanchor: 'top',
        text: `Spectrometer Voltage: ${spectrometerVoltage} V`,
        showarrow: false,
        font: { size: 18, color: 'red' }
      }
    ];

    let tracesArray = Object.values(spectrometerData.traces).map(data => data.trace);
    Plotly.react(spectrometerGraphDiv, tracesArray, spectrometerData.layout, spectrometerData.config);
  }

  Plotly.newPlot(spectrometerGraphDiv, [], spectrometerData.layout, spectrometerData.config);

  const spectrometerVoltageGraphDiv = document.getElementById('spectrometer-voltage-graph');
  let spectrometerVoltageData = {
    x: [],
    y: [],
    layout: {
      title: 'Spectrometer Voltage',
      xaxis: { title: 'Time (seconds)', range: [0, 10] },
      yaxis: { title: 'Voltage (V)' },
      margin: { t: 50, b: 70, l: 70, r: 50 },
      font: { family: "Rubik, sans-serif" }
    },
    config: { responsive: true },
    startTime: null
  };

  function updateSpectrometerVoltageGraph(timestamp, telemetryData) {
    if (!timestamp || !telemetryData['spectrometer-voltage']) return;

    let time = unixToHumanReadable(timestamp);  // Use the conversion function

    if (spectrometerVoltageData.startTime === null) {
      spectrometerVoltageData.startTime = new Date(time);
    }

    let elapsedTime = (new Date(time) - spectrometerVoltageData.startTime) / 1000;
    let voltage = telemetryData['spectrometer-voltage'];

    spectrometerVoltageData.x.push(elapsedTime);
    spectrometerVoltageData.y.push(voltage);

    let minX = Math.max(0, elapsedTime - 10);
    let maxX = minX + 10;
    spectrometerVoltageData.layout.xaxis.range = [minX, maxX];

    const trace = {
      x: spectrometerVoltageData.x,
      y: spectrometerVoltageData.y,
      mode: 'lines+markers',
      name: 'Spectrometer Voltage',
      line: { width: 2 },
      text: spectrometerVoltageData.x.map((t, i) => {
        let formattedTime = new Date(spectrometerVoltageData.startTime.getTime() + t * 1000).toLocaleTimeString("en-GB");
        return `Time: ${formattedTime}<br>Voltage: ${spectrometerVoltageData.y[i]}V`;
      }),
      hoverinfo: 'text'
    };

    Plotly.react(spectrometerVoltageGraphDiv, [trace], spectrometerVoltageData.layout, spectrometerVoltageData.config);
  }

  Plotly.newPlot(spectrometerVoltageGraphDiv, [], spectrometerVoltageData.layout, spectrometerVoltageData.config);


  const accelerometerGraphDiv = document.getElementById('accelerometer-graph');
  let accelerometerData = {
    x: [],
    y: [],
    layout: {
      title: 'Acceleration',
      xaxis: { title: 'Time (seconds)', range: [0, 10] },
      yaxis: { title: 'Acceleration (m/s²)' },
      margin: { t: 50, b: 70, l: 70, r: 50 },
      font: { family: "Rubik, sans-serif" }
    },
    config: { responsive: true },
    startTime: null
  };

  function updateAccelerometerGraph(timestamp, telemetryData) {
    if (!timestamp || telemetryData['accelerometer'] === undefined) {
      console.error("Invalid telemetry data:", telemetryData);
      return;
    }

    let time = unixToHumanReadable(timestamp);  // Use the conversion function

    if (accelerometerData.startTime === null) {
      accelerometerData.startTime = new Date(time);
    }

    let elapsedTime = (new Date(time) - accelerometerData.startTime) / 1000;
    let acceleration = telemetryData['accelerometer']; // Now directly using the acceleration value


    accelerometerData.x.push(elapsedTime);
    accelerometerData.y.push(acceleration);

    let minX = Math.max(0, elapsedTime - 10);
    let maxX = minX + 10;
    accelerometerData.layout.xaxis.range = [minX, maxX];

    const trace = {
      x: accelerometerData.x,
      y: accelerometerData.y,
      mode: 'lines+markers',
      name: 'Acceleration',
      line: { width: 2 },
      text: accelerometerData.x.map((t, i) => {
        let formattedTime = new Date(accelerometerData.startTime.getTime() + t * 1000).toLocaleTimeString("en-GB");
        return `Time: ${formattedTime}<br>Acceleration: ${accelerometerData.y[i]} m/s²`;
      }),
      hoverinfo: 'text'
    };

    Plotly.react(accelerometerGraphDiv, [trace], accelerometerData.layout, accelerometerData.config);
  }

  // Initial plot
  Plotly.newPlot(accelerometerGraphDiv, [], accelerometerData.layout, accelerometerData.config);
}

const velocityGraphDiv = document.getElementById('velocity-graph');
let velocityData = {
  x: [], // Array to store time values
  y: [], // Array to store velocity values
  layout: {
    title: 'Velocity',
    xaxis: { title: 'Time (seconds)', range: [0, 10] },
    yaxis: { title: 'Velocity (m/s)' },
    margin: { t: 50, b: 70, l: 70, r: 50 },
    font: { family: "Rubik, sans-serif" }
  },
  config: { responsive: true },
  startTime: null,
};

// Helper function to convert Unix timestamp to human-readable time
function unixToHumanReadable(unixTimestamp) {
  const dateObj = new Date(unixTimestamp * 1000);  // Convert from seconds to milliseconds
  return dateObj.toLocaleString();  // Converts to a human-readable date/time string
}

function updateVelocityGraph(timestamp, telemetryData) {
  // Check if telemetryData contains valid velocity data
  if (!timestamp || telemetryData['velocity'] === undefined) {
    console.error("Invalid telemetry data:", telemetryData);
    return;
  }

  // Convert the timestamp to human-readable format
  let time = unixToHumanReadable(timestamp);

  // Set the start time for the first data point
  if (velocityData.startTime === null) {
    velocityData.startTime = new Date(time);
  }

  // Calculate elapsed time (in seconds)
  let elapsedTime = (new Date(time) - velocityData.startTime) / 1000;

  // Get the velocity value from telemetry data
  let velocity = telemetryData['velocity'];

  // Add new data to the arrays
  velocityData.x.push(elapsedTime);
  velocityData.y.push(velocity);

  // Update the x-axis range to show the last 10 seconds of data
  let minX = Math.max(0, elapsedTime - 10);
  let maxX = minX + 10;
  velocityData.layout.xaxis.range = [minX, maxX];

  // Create the trace for Plotly
  const trace = {
    x: velocityData.x,
    y: velocityData.y,
    mode: 'lines+markers',
    name: 'Velocity',
    line: { width: 2 },
    text: velocityData.x.map((t, i) => {
      let formattedTime = new Date(velocityData.startTime.getTime() + t * 1000).toLocaleTimeString("en-GB");
      return `Time: ${formattedTime}<br>Velocity: ${velocityData.y[i]} m/s`;
    }),
    hoverinfo: 'text'
  };

  // Update the velocity graph with new data
  Plotly.react(velocityGraphDiv, [trace], velocityData.layout, velocityData.config);
}

// Initial plot setup for the velocity graph
Plotly.newPlot(velocityGraphDiv, [], velocityData.layout, velocityData.config);


document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;

  // Check for saved theme in localStorage
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme) {
    body.setAttribute("data-theme", savedTheme);
    themeToggle.checked = savedTheme === "light";
  }

  // Toggle theme on switch change
  themeToggle.addEventListener("change", function () {
    if (themeToggle.checked) {
      body.setAttribute("data-theme", "light");
      localStorage.setItem("theme", "light");
    } else {
      body.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    }
  });
});

let timerInterval = null; // Timer interval
let isTimerRunning = false; // Track if timer is running
let timerStartTime = null; // When the timer was started by user
let timerEndTime = null; // When the timer was stopped by user

// Function to start the timer (only when user clicks Start)
function startTimer() {
  if (isTimerRunning) return;

  timerStartTime = Math.floor(Date.now() / 1000);
  sessionStorage.setItem("timerStartTime", timerStartTime);
  
  timerInterval = setInterval(updateTimer, 1000);
  isTimerRunning = true;

  const startStopButton = document.getElementById('start-stop-timer');
  startStopButton.textContent = 'Stop';
  startStopButton.classList.add('running');

  document.getElementById('start-time').textContent = new Date(timerStartTime * 1000).toLocaleTimeString();
  document.getElementById('start-time').classList.add('start-time-color');
  document.getElementById('end-time').textContent = '--:--:--';
  document.getElementById('end-time').classList.remove('end-time-color');
}

// Function to stop the timer
function stopTimer() {
  if (!isTimerRunning) return;

  clearInterval(timerInterval);
  isTimerRunning = false;
  
  timerEndTime = Math.floor(Date.now() / 1000);
  sessionStorage.setItem("timerEndTime", timerEndTime);
  
  const startStopButton = document.getElementById('start-stop-timer');
  startStopButton.textContent = 'Start';
  startStopButton.classList.remove('running');

  document.getElementById('end-time').textContent = new Date(timerEndTime * 1000).toLocaleTimeString();
  document.getElementById('end-time').classList.add('end-time-color');
}

// Function to update the timer display
function updateTimer() {
  if (!timerStartTime) return;

  const currentTime = Math.floor(Date.now() / 1000);
  const elapsedTime = currentTime - timerStartTime;

  const hours = Math.floor(elapsedTime / 3600);
  const minutes = Math.floor((elapsedTime % 3600) / 60);
  const seconds = elapsedTime % 60;

  document.getElementById('timer').textContent = 
    `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Reset Timer
document.getElementById('reset-timer').addEventListener('click', () => {
  clearInterval(timerInterval);
  document.getElementById('timer').textContent = '00:00:00';
  document.getElementById('start-time').textContent = '--:--:--';
  document.getElementById('end-time').textContent = '--:--:--';
  
  const startStopButton = document.getElementById('start-stop-timer');
  startStopButton.textContent = 'Start';
  startStopButton.classList.remove('running');
  
  document.getElementById('start-time').classList.remove('start-time-color');
  document.getElementById('end-time').classList.remove('end-time-color');

  isTimerRunning = false;
  timerStartTime = null;
  timerEndTime = null;
  sessionStorage.removeItem("timerStartTime");
  sessionStorage.removeItem("timerEndTime");
});

// Start/Stop button handler
document.getElementById('start-stop-timer').addEventListener('click', () => {
  if (isTimerRunning) {
    stopTimer();
  } else {
    startTimer();
  }
});

// Initialize from session storage
const storedStartTime = sessionStorage.getItem("timerStartTime");
const storedEndTime = sessionStorage.getItem("timerEndTime");

if (storedStartTime) {
  timerStartTime = parseInt(storedStartTime);
  document.getElementById('start-time').textContent = new Date(timerStartTime * 1000).toLocaleTimeString();
  document.getElementById('start-time').classList.add('start-time-color');

  if (storedEndTime) {
    timerEndTime = parseInt(storedEndTime);
    document.getElementById('end-time').textContent = new Date(timerEndTime * 1000).toLocaleTimeString();
    document.getElementById('end-time').classList.add('end-time-color');
  } else {        
    startTimer();
  }
}