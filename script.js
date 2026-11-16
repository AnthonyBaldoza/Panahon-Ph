/* =========================================================
   Panahon PH — Application Logic
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Constants ---------- */

  const CITIES = [
    { name: "Manila", lat: 14.5995, lon: 120.9842 },
    { name: "Quezon City", lat: 14.676, lon: 121.0437 },
    { name: "Baguio", lat: 16.4023, lon: 120.596 },
    { name: "Laoag", lat: 18.1978, lon: 120.5936 },
    { name: "Vigan", lat: 17.5747, lon: 120.3869 },
    { name: "Tagaytay", lat: 14.1153, lon: 120.9621 },
    { name: "Legazpi", lat: 13.1391, lon: 123.7438 },
    { name: "Puerto Princesa", lat: 9.7392, lon: 118.7353 },
    { name: "Iloilo City", lat: 10.7202, lon: 122.5621 },
    { name: "Bacolod", lat: 10.6765, lon: 122.9509 },
    { name: "Cebu City", lat: 10.3157, lon: 123.8854 },
    { name: "Tacloban", lat: 11.2543, lon: 124.9631 },
    { name: "Cagayan de Oro", lat: 8.4542, lon: 124.6319 },
    { name: "Davao City", lat: 7.1907, lon: 125.4553 },
    { name: "General Santos", lat: 6.1164, lon: 125.1716 },
    { name: "Zamboanga City", lat: 6.9214, lon: 122.079 },
  ];

  // WMO weather code -> [label, icon kind]
  const WMO = {
    0: ["Clear sky", "clear"],
    1: ["Mostly clear", "clear"],
    2: ["Partly cloudy", "partly"],
    3: ["Overcast", "cloud"],
    45: ["Fog", "fog"],
    48: ["Freezing fog", "fog"],
    51: ["Light drizzle", "drizzle"],
    53: ["Drizzle", "drizzle"],
    55: ["Heavy drizzle", "drizzle"],
    56: ["Freezing drizzle", "drizzle"],
    57: ["Freezing drizzle", "drizzle"],
    61: ["Light rain", "rain"],
    63: ["Rain", "rain"],
    65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "rain"],
    67: ["Freezing rain", "rain"],
    71: ["Light snow", "snow"],
    73: ["Snow", "snow"],
    75: ["Heavy snow", "snow"],
    77: ["Snow grains", "snow"],
    80: ["Light showers", "rain"],
    81: ["Showers", "rain"],
    82: ["Violent showers", "rain"],
    85: ["Snow showers", "snow"],
    86: ["Snow showers", "snow"],
    95: ["Thunderstorm", "storm"],
    96: ["Thunderstorm, hail", "storm"],
    99: ["Thunderstorm, hail", "storm"],
  };

  // Weather code -> atmosphere theme
  const THEME_MAP = {
    0: "clear",
    1: "clear",
    2: "cloud",
    3: "cloud",
    45: "fog",
    48: "fog",
    51: "rain",
    53: "rain",
    55: "rain",
    56: "rain",
    57: "rain",
    61: "rain",
    63: "rain",
    65: "rain",
    66: "rain",
    67: "rain",
    71: "snow",
    73: "snow",
    75: "snow",
    77: "snow",
    80: "rain",
    81: "rain",
    82: "rain",
    85: "snow",
    86: "snow",
    95: "storm",
    96: "storm",
    99: "storm",
  };

  /* ---------- State ---------- */

  const state = {
    unit: "c",
    city: CITIES[0],
    data: null,
    requestId: 0,
  };

  /* ---------- DOM refs ---------- */

  const $ = (id) => document.getElementById(id);
  const els = {
    app: null,
    status: null,
    notice: null,
    chips: null,
    q: null,
    res: null,
    geo: null,
    uC: null,
    uF: null,
  };

  /* ---------- Utilities ---------- */

  const escapeHTML = (str) =>
    String(str).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  const storage = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
  };

  const temp = (celsius) =>
    Math.round(state.unit === "c" ? celsius : (celsius * 9) / 5 + 32);

  const fmtHour = (iso) => {
    const h = parseInt(iso.slice(11, 13), 10);
    return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " AM" : " PM");
  };

  const fmtTime = (iso) => {
    const h = parseInt(iso.slice(11, 13), 10);
    return (
      (h % 12 === 0 ? 12 : h % 12) +
      ":" +
      iso.slice(14, 16) +
      (h < 12 ? " AM" : " PM")
    );
  };

  const dayLabel = (dateStr, i) => {
    if (i === 0) return "Today";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-PH", { weekday: "short" });
  };

  const compass = (deg) => {
    if (deg == null || Number.isNaN(deg)) return "";
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  };

  const uvLabel = (u) => {
    if (u == null) return "";
    if (u < 3) return "Low";
    if (u < 6) return "Moderate";
    if (u < 8) return "High";
    if (u < 11) return "Very high";
    return "Extreme";
  };

  const wmo = (code) => WMO[code] || ["Unknown", "cloud"];

  /* ---------- Weather SVG Icons ---------- */

  const CLOUD_PATH =
    '<path d="M16 34h18a7 7 0 0 0 0.4-13.97A10 10 0 0 0 15 22a6.5 6.5 0 0 0 1 12z" fill="var(--cloud)"/>';

  function weatherIcon(kind, isDay) {
    let s = '<svg viewBox="0 0 48 48" aria-hidden="true">';
    if (kind === "clear") {
      if (isDay) {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          const x1 = (24 + Math.cos(a) * 14).toFixed(1);
          const y1 = (24 + Math.sin(a) * 14).toFixed(1);
          const x2 = (24 + Math.cos(a) * 19).toFixed(1);
          const y2 = (24 + Math.sin(a) * 19).toFixed(1);
          s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--sun)" stroke-width="3" stroke-linecap="round"/>`;
        }
        s += '<circle cx="24" cy="24" r="9" fill="var(--sun)"/>';
      } else {
        s +=
          '<path d="M30 8a16 16 0 1 0 10 28A13 13 0 0 1 30 8z" fill="var(--sun)"/>';
      }
    } else if (kind === "partly") {
      if (isDay) {
        s += '<circle cx="18" cy="17" r="7" fill="var(--sun)"/>';
      } else {
        s +=
          '<path d="M22 6a11 11 0 1 0 8 19 9 9 0 0 1-8-19z" fill="var(--sun)"/>';
      }
      s += CLOUD_PATH;
    } else {
      s += CLOUD_PATH;
      if (kind === "fog") {
        s +=
          '<g stroke="var(--cloud)" stroke-width="3" stroke-linecap="round"><line x1="12" y1="41" x2="36" y2="41"/><line x1="16" y1="46" x2="32" y2="46"/></g>';
      } else if (kind === "drizzle" || kind === "rain") {
        const xs = kind === "drizzle" ? [18, 28] : [16, 24, 32];
        xs.forEach((x) => {
          s += `<line x1="${x}" y1="40" x2="${x - 3}" y2="46" stroke="var(--rain)" stroke-width="3" stroke-linecap="round"/>`;
        });
      } else if (kind === "snow") {
        s +=
          '<g stroke="var(--cloud)" stroke-width="2" stroke-linecap="round"><line x1="17" y1="42" x2="17" y2="46"/><line x1="15" y1="44" x2="19" y2="44"/><line x1="24" y1="42" x2="24" y2="46"/><line x1="22" y1="44" x2="26" y2="44"/><line x1="31" y1="42" x2="31" y2="46"/><line x1="29" y1="44" x2="33" y2="44"/></g>';
      } else if (kind === "storm") {
        s +=
          '<polygon points="25,32 17,43 23,43 21,50 31,38 25,38 28,32" fill="var(--sun)"/>';
      }
    }
    return s + "</svg>";
  }

  // Small stat icons (Lucide-style)
  const STAT_ICONS = {
    humidity:
      '<path d="M12 3.5c3 4 6 7 6 10.5a6 6 0 1 1-12 0c0-3.5 3-6.5 6-10.5z"/>',
    wind: '<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h9"/>',
    rain: '<path d="M4 14a4 4 0 0 1 1-7.9 6 6 0 0 1 11.5-1A3.5 3.5 0 0 1 19 14M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
    pressure: '<path d="M12 14l4-4M5 19a8 8 0 1 1 14 0"/>',
    uv: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4 4.2 19.8M19.8 4.2l-1.4 1.4"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };

  function statIcon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${STAT_ICONS[name] || ""}</svg>`;
  }

  /* ---------- API ---------- */

  async function fetchJSON(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function buildForecastURL(city) {
    return (
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${city.lat}&longitude=${city.lon}` +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation," +
      "weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,is_day" +
      "&hourly=temperature_2m,precipitation_probability,weather_code,is_day,visibility" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum," +
      "precipitation_probability_max,sunrise,sunset,uv_index_max" +
      "&timezone=Asia%2FManila&forecast_days=7"
    );
  }

  /* ---------- UI helpers ---------- */

  function setStatus(msg) {
    if (els.status) els.status.textContent = msg;
  }

  function setNotice(html, kind = "warn") {
    if (!els.notice) return;
    els.notice.hidden = !html;
    els.notice.className = "notice" + (kind === "error" ? " error" : "");
    els.notice.innerHTML = html || "";
    const btn = els.notice.querySelector("button");
    if (btn) btn.addEventListener("click", () => loadWeather(state.city));
  }

  function applyTheme(code, isDay) {
    const theme = THEME_MAP[code] || "cloud";
    const suffix = theme === "clear" ? (isDay ? "-day" : "-night") : "";
    document.body.className = `theme-${theme}${suffix}`;
  }

  /* ---------- Render: loading / error ---------- */

  function renderLoading() {
    els.app.innerHTML = `
      <section class="now skeleton" aria-hidden="true">
        <div class="now-main">
          <div class="sk-line" style="width:40%"></div>
          <div class="sk-line sk-lg" style="width:60%"></div>
          <div class="sk-line" style="width:30%"></div>
          <div class="sk-line" style="width:50%"></div>
        </div>
        <div class="sk-icon"></div>
      </section>
      <section class="highlights" aria-hidden="true">
        ${Array.from(
          { length: 6 },
          () => `
          <div class="stat skeleton">
            <div class="sk-line" style="width:40%"></div>
            <div class="sk-line sk-md" style="width:60%;margin-top:10px"></div>
          </div>`,
        ).join("")}
      </section>
      <section class="panel skeleton" aria-hidden="true">
        <div class="sk-line" style="width:25%"></div>
        <div class="sk-line" style="width:100%;height:110px;margin-top:14px"></div>
      </section>`;
  }

  function renderError(message) {
    els.app.innerHTML = `
      <section class="empty" role="alert">
        <h2>Weather unavailable</h2>
        <p>${escapeHTML(message)}</p>
        <button type="button" class="btn primary" id="retry">Try again</button>
      </section>`;
    const retry = document.getElementById("retry");
    if (retry) retry.addEventListener("click", () => loadWeather(state.city));
  }

  /* ---------- Render: main ---------- */

  function render() {
    const { data, city } = state;
    if (!data || !data.current || !data.hourly || !data.daily) {
      renderError("The weather service returned incomplete data.");
      return;
    }

    const cur = data.current;
    const hr = data.hourly;
    const dy = data.daily;

    const [condLabel, condIcon] = wmo(cur.weather_code);
    const isDay = !!cur.is_day;
    applyTheme(cur.weather_code, isDay);

    // Locate the current hour within the hourly arrays
    const nowKey = cur.time.slice(0, 13) + ":00";
    let hStart = 0;
    while (hStart < hr.time.length && hr.time[hStart] < nowKey) hStart++;
    hStart = Math.min(hStart, hr.time.length - 1);

    // Visibility (only available via hourly in Open-Meteo — meters → km)
    const visibilityKm =
      hr.visibility && hr.visibility[hStart] != null
        ? (hr.visibility[hStart] / 1000).toFixed(1)
        : null;

    /* ----- Hourly strip ----- */
    let hoursHTML = "";
    const hourEnd = Math.min(hStart + 24, hr.time.length);
    for (let i = hStart; i < hourEnd; i++) {
      const [, hIcon] = wmo(hr.weather_code[i]);
      const pp = hr.precipitation_probability[i];
      const label = i === hStart ? "Now" : fmtHour(hr.time[i]);
      hoursHTML += `
        <div class="hour">
          <span class="t">${label}</span>
          ${weatherIcon(hIcon, !!hr.is_day[i])}
          <span class="d tnum">${temp(hr.temperature_2m[i])}°</span>
          <span class="p tnum">${pp >= 20 ? pp + "%" : ""}</span>
        </div>`;
    }

    /* ----- Daily list with shared temperature-range scale ----- */
    const loMin = Math.min(...dy.temperature_2m_min);
    const hiMax = Math.max(...dy.temperature_2m_max);
    const span = Math.max(hiMax - loMin, 1);

    let daysHTML = "";
    for (let j = 0; j < dy.time.length; j++) {
      const [dLabel, dIcon] = wmo(dy.weather_code[j]);
      const left = (((dy.temperature_2m_min[j] - loMin) / span) * 100).toFixed(
        1,
      );
      const width = Math.max(
        ((dy.temperature_2m_max[j] - dy.temperature_2m_min[j]) / span) * 100,
        6,
      ).toFixed(1);
      const rp = dy.precipitation_probability_max[j];
      daysHTML += `
        <div class="day" title="${escapeHTML(dLabel)}">
          <span class="n">${escapeHTML(dayLabel(dy.time[j], j))}</span>
          ${weatherIcon(dIcon, true)}
          <span class="p tnum">${rp != null ? rp + "%" : ""}</span>
          <span class="lo tnum">${temp(dy.temperature_2m_min[j])}°</span>
          <span class="range"><i style="left:${left}%;width:${width}%"></i></span>
          <span class="hi tnum">${temp(dy.temperature_2m_max[j])}°</span>
        </div>`;
    }

    /* ----- Highlights ----- */
    const uv = dy.uv_index_max[0];
    const windDir = compass(cur.wind_direction_10m);
    const humidity = Math.round(cur.relative_humidity_2m);
    const pressure = Math.round(cur.surface_pressure);
    const wind = Math.round(cur.wind_speed_10m);
    const rainToday = dy.precipitation_sum[0];
    const pop = dy.precipitation_probability_max[0];

    const highlightsHTML = `
      <div class="stat">
        <div class="k">${statIcon("humidity")}Humidity</div>
        <div class="v tnum">${humidity}<small>%</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("wind")}Wind</div>
        <div class="v tnum">${wind}<small>km/h ${escapeHTML(windDir)}</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("rain")}Rain today</div>
        <div class="v tnum">${rainToday != null ? rainToday.toFixed(1) : "–"}<small>mm</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("pressure")}Pressure</div>
        <div class="v tnum">${pressure}<small>hPa</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("uv")}UV index</div>
        <div class="v tnum">${uv != null ? Math.round(uv) : "–"}<small>${uvLabel(uv)}</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("eye")}Visibility</div>
        <div class="v tnum">${visibilityKm != null ? visibilityKm : "–"}<small>${visibilityKm != null ? "km" : ""}</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("rain")}Chance of rain</div>
        <div class="v tnum">${pop != null ? pop : "–"}<small>%</small></div>
      </div>
      <div class="stat">
        <div class="k">${statIcon("sun")}Sun</div>
        <div class="v tnum" style="font-size:15px;line-height:1.5">
          ↑ ${fmtTime(dy.sunrise[0])}<br>↓ ${fmtTime(dy.sunset[0])}
        </div>
      </div>`;

    /* ----- Compose ----- */
    const hi = temp(dy.temperature_2m_max[0]);
    const lo = temp(dy.temperature_2m_min[0]);
    const sub = city.sub ? `, ${escapeHTML(city.sub)}` : "";

    els.app.innerHTML = `
      <section class="now" aria-label="Current conditions">
        <div class="now-main">
          <div class="place">
            <strong>${escapeHTML(city.name)}${sub}</strong>
          </div>
          <div class="temp tnum">
            ${temp(cur.temperature_2m)}<sup>°${state.unit.toUpperCase()}</sup>
          </div>
          <div class="cond">${escapeHTML(condLabel)}</div>
          <div class="sub tnum">
            Feels like ${temp(cur.apparent_temperature)}°
            <span class="dot">·</span>High ${hi}°
            <span class="dot">·</span>Low ${lo}°
          </div>
          <div class="sub">Updated ${fmtTime(cur.time)}</div>
        </div>
        <div class="big-icon">${weatherIcon(condIcon, isDay)}</div>
      </section>

      <section class="highlights" aria-label="Weather highlights">
        ${highlightsHTML}
      </section>

      <section class="panel" aria-label="Next 24 hours">
        <h2>Next 24 hours</h2>
        <div class="hours">${hoursHTML}</div>
      </section>

      <section class="panel" aria-label="7-day forecast">
        <h2>7-day forecast</h2>
        <div class="days">${daysHTML}</div>
      </section>`;

    setStatus(`Weather for ${city.name} loaded.`);
  }

  /* ---------- Chips ---------- */

  function renderChips() {
    if (!els.chips) return;
    els.chips.innerHTML = "";
    CITIES.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = c.name;
      const active =
        c.name === state.city.name &&
        !state.city.sub &&
        c.lat === state.city.lat &&
        c.lon === state.city.lon;
      b.setAttribute("aria-pressed", String(active));
      b.addEventListener("click", () => {
        els.q.value = "";
        closeResults();
        loadWeather(c);
      });
      els.chips.appendChild(b);
    });
  }

  /* ---------- Search results ---------- */

  function closeResults() {
    if (!els.res) return;
    els.res.hidden = true;
    els.q.setAttribute("aria-expanded", "false");
  }

  function showResults(items) {
    const ul = els.res;
    ul.innerHTML = "";
    if (!items.length) {
      ul.innerHTML =
        '<li class="none">No matching places in the Philippines.</li>';
    } else {
      items.forEach((p) => {
        const li = document.createElement("li");
        li.setAttribute("role", "option");
        const b = document.createElement("button");
        b.type = "button";
        const sub = [p.admin2, p.admin1].filter(Boolean).join(", ");
        b.innerHTML = `<span>${escapeHTML(p.name)}</span><small>${escapeHTML(sub || "Philippines")}</small>`;
        b.addEventListener("click", () => {
          els.q.value = "";
          closeResults();
          loadWeather({
            name: p.name,
            sub: p.admin1 || "",
            lat: p.latitude,
            lon: p.longitude,
          });
        });
        li.appendChild(b);
        ul.appendChild(li);
      });
    }
    ul.hidden = false;
    els.q.setAttribute("aria-expanded", "true");
  }

  /* ---------- Actions ---------- */

  async function loadWeather(city) {
    state.city = city;
    storage.set("panahon.city", city);
    renderChips();

    const id = ++state.requestId;
    renderLoading();
    setNotice("");
    setStatus(`Loading weather for ${city.name}…`);

    try {
      const data = await fetchJSON(buildForecastURL(city), 12000);
      if (id !== state.requestId) return;
      state.data = data;
      render();
    } catch (err) {
      if (id !== state.requestId) return;
      state.data = null;
      renderError(
        "Could not reach the weather service. Please check your connection and try again.",
      );
      setStatus("Failed to load weather data.");
    }
  }

  let searchTimer = null;

  async function searchPlaces(term) {
    const url =
      "https://geocoding-api.open-meteo.com/v1/search" +
      `?name=${encodeURIComponent(term)}&count=8&language=en&countryCode=PH`;
    try {
      const res = await fetchJSON(url, 8000);
      if (els.q.value.trim() !== term) return;
      showResults(res.results || []);
    } catch {
      els.res.innerHTML =
        '<li class="none">Search is unavailable right now. Pick a place from the list below.</li>';
      els.res.hidden = false;
      els.q.setAttribute("aria-expanded", "true");
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setNotice(
        "<span>Your browser does not support location services.</span>",
        "error",
      );
      return;
    }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        loadWeather({
          name: "My location",
          sub: "",
          lat: +pos.coords.latitude.toFixed(4),
          lon: +pos.coords.longitude.toFixed(4),
        });
      },
      () => {
        setNotice(
          "<span>Location is blocked. Allow it in your browser, or search for your town instead.</span>",
          "error",
        );
        setStatus("Location unavailable.");
      },
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  function setUnit(unit) {
    state.unit = unit;
    storage.set("panahon.unit", unit);
    els.uC.setAttribute("aria-pressed", String(unit === "c"));
    els.uF.setAttribute("aria-pressed", String(unit === "f"));
    if (state.data) render();
  }

  /* ---------- Init ---------- */

  function init() {
    els.app = $("app");
    els.status = $("status");
    els.notice = $("notice");
    els.chips = $("chips");
    els.q = $("q");
    els.res = $("res");
    els.geo = $("geo");
    els.uC = $("uC");
    els.uF = $("uF");

    // Restore preferences
    const savedUnit = storage.get("panahon.unit", null);
    if (savedUnit === "c" || savedUnit === "f") {
      state.unit = savedUnit;
    }
    els.uC.setAttribute("aria-pressed", String(state.unit === "c"));
    els.uF.setAttribute("aria-pressed", String(state.unit === "f"));

    const savedCity = storage.get("panahon.city", null);
    if (
      savedCity &&
      typeof savedCity.lat === "number" &&
      typeof savedCity.lon === "number" &&
      savedCity.name
    ) {
      state.city = savedCity;
    }

    // Wire events
    els.uC.addEventListener("click", () => setUnit("c"));
    els.uF.addEventListener("click", () => setUnit("f"));
    els.geo.addEventListener("click", useMyLocation);

    els.q.addEventListener("input", function () {
      const term = this.value.trim();
      clearTimeout(searchTimer);
      if (term.length < 2) {
        closeResults();
        return;
      }
      searchTimer = setTimeout(() => searchPlaces(term), 300);
    });

    els.q.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeResults();
      if (e.key === "Enter") {
        const first = els.res.querySelector("button");
        if (first) first.click();
      }
      if (e.key === "ArrowDown") {
        const first = els.res.querySelector("button");
        if (first) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".field")) closeResults();
    });

    // Go
    renderChips();
    loadWeather(state.city);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
