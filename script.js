async function findDuplicates() {
    let embyServerUrl = document.getElementById('embyServerUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value;
    const resultsDiv = document.getElementById('results');
    const loadingOverlay = document.getElementById('loading-overlay');

    resultsDiv.innerHTML = '';
    loadingOverlay.classList.remove('hidden');

    if (!/^https?:\/\//i.test(embyServerUrl)) {
        embyServerUrl = 'http://' + embyServerUrl;
    }

    try {
        const libraries = await fetchLibraries(embyServerUrl, apiKey);
        const movieLibraries = libraries.filter(lib => lib.CollectionType === 'movies');
        const duplicateResults = [];

        for (const library of movieLibraries) {
            const movies = await fetchMoviesFromLibrary(embyServerUrl, apiKey, library.ItemId);
            const duplicates = findDuplicatesInLibrary(movies);
            if (Object.keys(duplicates).length > 0) {
                duplicateResults.push({
                    libraryName: library.Name,
                    duplicates: duplicates,
                    count: Object.keys(duplicates).length
                });
            }
        }

        displayResults(duplicateResults);
    } catch (error) {
        resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

async function fetchLibraries(embyServerUrl, apiKey) {
    const response = await fetch(`${embyServerUrl}/emby/Library/VirtualFolders?api_key=${apiKey}`);
    if (!response.ok) throw new Error('Failed to fetch libraries');
    return await response.json();
}

async function fetchMoviesFromLibrary(embyServerUrl, apiKey, libraryId) {
    const response = await fetch(`${embyServerUrl}/emby/Items?Recursive=true&ParentId=${libraryId}&IncludeItemTypes=Movie&Fields=Path,ProductionYear&api_key=${apiKey}`);
    if (!response.ok) throw new Error(`Failed to fetch movies from library ${libraryId}`);
    const data = await response.json();
    return data.Items || [];
}

function findDuplicatesInLibrary(movies) {
    const duplicates = {};
    const duplicatesByName = {};

    movies.forEach(movie => {
        const name = movie.Name;
        const year = movie.ProductionYear;
        const path = movie.Path;

        if (!name) return;

        const key = year ? `${name.trim()}_${year}` : name.trim();
        if (!duplicates[key]) duplicates[key] = [];
        duplicates[key].push({ path, year });

        if (!duplicatesByName[name.trim()]) duplicatesByName[name.trim()] = [];
        duplicatesByName[name.trim()].push({ path, year });
    });

    const finalDuplicates = {};
    for (const [key, paths] of Object.entries(duplicates)) {
        if (paths.length > 1) finalDuplicates[key] = paths;
    }

    for (const [name, paths] of Object.entries(duplicatesByName)) {
        if (paths.length > 1 && new Set(paths.map(p => p.year)).size > 1) {
            finalDuplicates[name] = paths;
        }
    }

    return finalDuplicates;
}

function displayResults(duplicateResults) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (duplicateResults.length === 0) {
        resultsDiv.innerHTML = '<p>No duplicates found in any library.</p>';
        return;
    }

    duplicateResults.forEach((result, index) => {
        const libraryBox = document.createElement('div');
        libraryBox.className = 'library-box';
        libraryBox.style.animationDelay = `${index * 0.1}s`;
        libraryBox.innerHTML = `
            <h3>${result.libraryName}</h3>
            <p>Total duplicate movies: ${result.count}</p>
            <button onclick="downloadDuplicates('${result.libraryName}', ${JSON.stringify(result.duplicates).replace(/"/g, '&quot;')})">Download List</button>
        `;
        resultsDiv.appendChild(libraryBox);
    });
}

function downloadDuplicates(libraryName, duplicates) {
    let content = `Duplicates in library: ${libraryName}\n\n`;
    for (const [key, paths] of Object.entries(duplicates)) {
        content += `Duplicate found: ${key}\n`;
        paths.forEach(({ path, year }) => {
            content += `  - ${path} (${year})\n`;
        });
        content += '\n';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${libraryName}_duplicates.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}