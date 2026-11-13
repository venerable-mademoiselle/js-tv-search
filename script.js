/*
"Talk is cheap. Show me the code."
—Linus Torvalds
*/

// Palabas · WS1 TV Show Search code-along (TVmaze API, no key needed)
// Open DevTools (F12): keep the Console AND the Network tab open.
// Sample or live mode: see config.js.

// ---------- Given: page elements ----------
const form = document.getElementById("searchForm");
const input = document.getElementById("query");
const statusText = document.getElementById("status");
const results = document.getElementById("results");
const dialog = document.getElementById("details");
const detailsBody = document.getElementById("detailsBody");
const closeBtn = document.getElementById("closeDetails");
const modeBadge = document.getElementById("modeBadge");

// ---------- Given: the API's URLs ----------
const API = "https://api.tvmaze.com";

// Turns "Breaking Bad" into "breaking-bad" (used for the sample-data file names)
function slug(text) {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// e.g. https://api.tvmaze.com/search/shows?q=breaking%20bad
function searchURL(query) {
  if (USE_SAMPLE_DATA) return `data/search/${slug(query)}.json`;
  return `${API}/search/shows?q=${encodeURIComponent(query)}`;
}

// e.g. https://api.tvmaze.com/shows/169
function showURL(id) {
  return USE_SAMPLE_DATA ? `data/shows/${id}.json` : `${API}/shows/${id}`;
}

// e.g. https://api.tvmaze.com/shows/169/cast
function castURL(id) {
  return USE_SAMPLE_DATA ? `data/cast/${id}.json` : `${API}/shows/${id}/cast`;
}

// e.g. https://api.tvmaze.com/shows/169/seasons
function seasonsURL(id) {
  return USE_SAMPLE_DATA ? `data/seasons/${id}.json` : `${API}/shows/${id}/seasons`;
}

// ---------- Given: helpers (no need to change) ----------

// Shows a message under the search box. type: "info", "loading" or "error"
function setStatus(message, type = "info") {
  statusText.textContent = message;
  statusText.className = "status " + type;
}

// Makes an element with an optional class and text: el("span", "year", "2008")
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// A poster <img>, or a placeholder when the show has no image (image is null)
function createPoster(show, size = "medium") {
  if (!show.image) {
    return el("span", "poster none", "No poster");
  }
  const img = el("img", "poster");
  img.src = show.image[size] || show.image.medium;
  img.alt = `Poster: ${show.name}`;
  img.loading = "lazy";
  img.addEventListener("error", () => img.replaceWith(el("span", "poster none", "No poster")));
  return img;
}

// "2008–2013", or "2016–" for a show that is still running
function yearRange(show) {
  const start = show.premiered ? show.premiered.slice(0, 4) : "?";
  const end = show.ended ? show.ended.slice(0, 4) : "";
  return `${start}–${end}`;
}

// TVmaze summaries contain HTML like "<p><b>Friends</b> follows…</p>".
// This keeps only the text. (Never put text from an API into innerHTML:
// if it contained a <script> or an onerror, it could run on your page.)
function stripTags(html) {
  if (!html) return "No summary yet.";
  return new DOMParser().parseFromString(html, "text/html").body.textContent;
}

// Close the details pop-up (Step 4) with the × button or by clicking outside it
closeBtn.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

// Show which mode we're in
modeBadge.textContent = USE_SAMPLE_DATA ? "Sample data" : "Live · TVmaze";
modeBadge.classList.toggle("live", !USE_SAMPLE_DATA);

// Fetches the search results for friends and logs the response details to test the API
async function testRequest() {
  const url = searchURL("friends");
  console.log("Request:", url);

  const response = await fetch(url);
  console.log("Status:", response.status, "ok?", response.ok);

  const data = await response.json();
  console.log(data);
  console.log("How many:", data.length);
  console.log("First show:", data[0].show.name, data[0].show.premiered);
}

// Creates a button card for each TV show and adds it to the results container
function renderResults(items) {
  results.innerHTML = "";
  items.forEach((item) => {
    const show = item.show;
    const card = el("button", "card");
    card.type = "button";
    card.dataset.id = show.id;

    const rating = show.rating.average;
    card.append(
      createPoster(show),
      el("span", "title", show.name),
      el("span", "year", yearRange(show)),
      el("span", "genres", show.genres.join(", ")),
      el("span", "rating", rating ? `★ ${rating}` : "Not rated yet")
    );
    results.appendChild(card);
  });
}

// Fetches JSON data from the given URL and throws a readable error if something goes wrong
async function getJSON(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    throw new Error("Can't reach TVmaze. Check your internet, or use sample mode.");
  }

  if (response.status === 429) {
    throw new Error("Too many requests (429). Wait 10 seconds and try again.");
  }

  if (!response.ok) {
    if (USE_SAMPLE_DATA) {
      throw new Error(
        `Request failed (HTTP ${response.status}). In sample mode, try: friends, office, breaking bad, stranger things, sherlock, thrones, or sample.`
      );
    }
    throw new Error(`Request failed (HTTP ${response.status}).`);
  }

  return response.json();
}

// Searches for shows matching the query and updates the status message and results grid
async function searchShows(query) {
  setStatus(`Searching for "${query}"…`, "loading");
  results.innerHTML = "";
  try {
    const data = await getJSON(searchURL(query));
    if (data.length === 0) {
      setStatus(`No shows found for "${query}".`, "error");
      return;
    }
    renderResults(data);
    setStatus(
      `${data.length} ${data.length === 1 ? "show" : "shows"} found for "${query}".`
    );
  } catch (error) {
    setStatus(error.message, "error");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (query === "") return;
  searchShows(query);
});

results.addEventListener("click", (event) => {
  const card = event.target.closest(".card");
  if (card) showDetails(card.dataset.id);
});

// Opens the details modal and loads the show info, cast, and seasons at the same time
async function showDetails(id) {
  detailsBody.replaceChildren(el("p", "status loading", "Loading details…"));
  dialog.showModal();
  try {
    const start = performance.now();
    const [show, cast, seasons] = await Promise.all([
      getJSON(showURL(id)),
      getJSON(castURL(id)),
      getJSON(seasonsURL(id)),
    ]);
    console.log(`3 requests in ${Math.round(performance.now() - start)} ms`);
    renderDetails(show, cast, seasons);
  } catch (error) {
    detailsBody.replaceChildren(el("p", "status error", error.message));
  }
}

// Displays the full show details, season count, and top 6 cast members inside the modal
function renderDetails(show, cast, seasons) {
  const poster = createPoster(show, "original");
  const info = el("div", "details-info");

  const network = show.network
    ? show.network.name
    : show.webChannel
    ? show.webChannel.name
    : "Unknown network";
  const genres = show.genres.length ? show.genres.join(", ") : "No genres listed";
  const runtime = show.runtime || show.averageRuntime;
  const runtimeText = runtime ? `${runtime} min` : "Unknown runtime";

  const meta = el("p", "meta", `${yearRange(show)} · ${network} · ${genres} · ${runtimeText}`);

  const rating = show.rating.average
    ? `★ ${show.rating.average}`
    : "Not rated yet";
  const ratingEl = el("p", "rating", rating);

  const seasonCount = `${seasons.length} ${seasons.length === 1 ? "season" : "seasons"}`;
  const seasonsEl = el("p", "seasons", seasonCount);

  const summary = el("p", "summary");
  summary.textContent = show.summary
    ? stripTags(show.summary)
    : "No summary available.";

  const castHeading = el("h3", "", "Cast");
  const list = el("ul", "cast-list");
  if (cast.length === 0) {
    list.append(el("li", "", "No cast listed."));
  } else {
    cast.slice(0, 6).forEach((member) => {
      const li = el("li", "", member.person.name + " ");
      li.append(el("span", "", "as " + member.character.name));
      list.append(li);
    });
  }

  const link = el("a", "tvmaze-link", "View on TVmaze");
  link.href = show.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  info.append(
    el("h2", "", show.name),
    meta,
    ratingEl,
    seasonsEl,
    summary,
    castHeading,
    list,
    link
  );

  detailsBody.replaceChildren(poster, info);
}

let searchTimer;

input.addEventListener("input", () => {
  clearTimeout(searchTimer);
  const query = input.value.trim();
  if (query === "") return;
  searchTimer = setTimeout(() => {
    searchShows(query);
  }, 500);
});