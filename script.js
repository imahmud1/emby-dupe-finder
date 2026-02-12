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
    const response = await fetch(`${embyServerUrl}/emby/Items?Recursive=true&ParentId=${libraryId}&IncludeItemTypes=Movie&Fields=Path,ProductionYear,RunTimeTicks,MediaSources,MediaStreams&api_key=${apiKey}`);
    if (!response.ok) throw new Error(`Failed to fetch movies from library ${libraryId}`);
    const data = await response.json();
    return data.Items || [];
}

async function refreshLibrary() {
    let embyServerUrl = document.getElementById('embyServerUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value;
    const loadingOverlay = document.getElementById('loading-overlay');
    const resultsDiv = document.getElementById('results');

    if (!/^https?:\/\//i.test(embyServerUrl)) {
        embyServerUrl = 'http://' + embyServerUrl;
    }

    loadingOverlay.classList.remove('hidden');
    resultsDiv.innerHTML = '';

    try {
        const response = await fetch(`${embyServerUrl}/emby/Library/Refresh`, {
            method: 'POST',
            headers: {
                'X-Emby-Token': apiKey
            }
        });

        if (!response.ok) {
            throw new Error('Failed to refresh library');
        }

        resultsDiv.innerHTML = '<p>Library refresh triggered successfully!</p>';
    } catch (error) {
        resultsDiv.innerHTML = `<p>Error: ${error.message}</p>`;
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Utility functions for improved duplicate detection
function calculateSimilarity(str1, str2) {
    // Simple Levenshtein distance-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

function findDuplicatesInLibrary(movies) {
    const duplicates = {};

    movies.forEach(movie => {
        const name = movie.Name;
        const year = movie.ProductionYear;
        const path = movie.Path;
        
        // Get file size from MediaSources
        let fileSize = 0;
        if (movie.MediaSources && movie.MediaSources.length > 0) {
            fileSize = movie.MediaSources[0].Size || 0;
        }

        // Get resolution from MediaStreams
        let resolution = 'Unknown';
        if (movie.MediaStreams && movie.MediaStreams.length > 0) {
            const videoStream = movie.MediaStreams.find(stream => stream.Type === 'Video');
            if (videoStream && videoStream.Width && videoStream.Height) {
                resolution = `${videoStream.Width}x${videoStream.Height}`;
            }
        }

        if (!name) return;

        // Extract year from path if available (more reliable than metadata for remakes)
        let pathYear = null;
        if (path) {
            // Look for year in various formats in the path
            const pathYearMatch = path.match(/[\\/\(\[\s](\d{4})[\)\]\s\.\-_]/);
            if (pathYearMatch) {
                pathYear = parseInt(pathYearMatch[1]);
            }
        }

        // Use path year if it exists and differs from metadata year, otherwise use metadata year
        const effectiveYear = (pathYear && pathYear !== year && pathYear >= 1900 && pathYear <= new Date().getFullYear()) ? pathYear : year;

        // Clean the movie name but be more conservative
        const cleanName = name.trim()
            .replace(/\s*\(\d{4}\)\s*/g, '') // Remove year in parentheses
            .replace(/\b(1080p|720p|4k|uhd|hdr|x264|x265|hevc|bluray|blu-ray|webrip|web-dl|brrip)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Create a more specific key using EXACT name match + year
        // This prevents different movies from being grouped together
        const exactKey = `${name.trim()}_${effectiveYear || 'unknown'}`;
        
        if (!duplicates[exactKey]) duplicates[exactKey] = [];
        duplicates[exactKey].push({ 
            path, 
            year, 
            size: fileSize, 
            resolution, 
            originalName: name.trim(),
            itemId: movie.Id,
            effectiveYear: effectiveYear,
            exactKey: exactKey
        });
    });

    // Only return groups that have multiple movies with IDENTICAL names and years
    const finalDuplicates = {};
    for (const [key, movies] of Object.entries(duplicates)) {
        if (movies.length > 1) {
            // Additional validation: ensure these are truly identical
            const firstMovie = movies[0];
            const allIdentical = movies.every(movie => 
                movie.originalName === firstMovie.originalName && 
                movie.effectiveYear === firstMovie.effectiveYear
            );
            
            if (allIdentical) {
                finalDuplicates[key] = movies;
            }
        }
    }

    return finalDuplicates;
}

function normalizeMovieName(name) {
    // Remove common edition/version indicators that don't change the core movie identity
    let normalized = name
        // Remove year in parentheses at the end
        .replace(/\s*\(\d{4}\)\s*$/g, '')
        // Remove edition types (case insensitive)
        .replace(/\b(director'?s? cut|extended|unrated|theatrical|ultimate|special|remastered|redux|final cut|criterion|collector'?s?)\b/gi, '')
        // Remove quality indicators
        .replace(/\b(1080p|720p|4k|uhd|hdr|dts|ac3|x264|x265|hevc|bluray|blu-ray|dvdrip|webrip|web-dl|brrip|hdtv)\b/gi, '')
        // Remove codec and container info
        .replace(/\b(mkv|mp4|avi|mov|wmv|flv|m4v|divx|xvid)\b/gi, '')
        // Remove audio channel info
        .replace(/\b(5\.1|7\.1|2\.0|stereo|mono)\b/gi, '')
        // Remove release group tags (usually in brackets or at the end)
        .replace(/\[[^\]]*\]/g, '')
        .replace(/\{[^}]*\}/g, '')
        // Remove parentheses content that might contain quality info, but preserve important story info
        .replace(/\([^)]*(?:1080p|720p|4k|uhd|hdr|dts|ac3|x264|x265|hevc|bluray|blu-ray|dvdrip|webrip|web-dl|brrip|hdtv|mkv|mp4|avi)[^)]*\)/gi, '')
        // Remove common release tags
        .replace(/\b(remux|internal|proper|repack|read\.nfo|nfo)\b/gi, '')
        // Clean up multiple spaces and trim
        .replace(/\s+/g, ' ')
        .trim();
    
    return normalized;
}

function filterOutSequels(movies) {
    // Since we're now using exact name + year matching, 
    // this function is much simpler - just return all movies
    // as they should already be true duplicates
    return movies;
}

function displayResults(duplicateResults) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    if (duplicateResults.length === 0) {
        resultsDiv.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
                color: white;
                padding: 40px 30px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 8px 25px rgba(116, 185, 255, 0.3);
                margin: 20px 0;
                animation: fadeInUp 0.6s ease-out;
            ">
                <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
                <h3 style="margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">Great News!</h3>
                <p style="margin: 0; font-size: 16px; opacity: 0.9;">No duplicate movies found in any of your libraries.</p>
                <p style="margin: 10px 0 0 0; font-size: 14px; opacity: 0.8;">Your media collection is perfectly organized!</p>
            </div>
            <style>
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>
        `;
        return;
    }

    duplicateResults.forEach((result, index) => {
        const libraryBox = document.createElement('div');
        libraryBox.className = 'library-box';
        libraryBox.style.animationDelay = `${index * 0.1}s`;
        libraryBox.innerHTML = `
            <h3>${result.libraryName}</h3>
            <p>Total duplicate movies: ${result.count}</p>
            <button onclick="showDuplicatesHTML('${result.libraryName}', ${JSON.stringify(result.duplicates).replace(/"/g, '&quot;')})">View Details</button>
            <button onclick="downloadDuplicates('${result.libraryName}', ${JSON.stringify(result.duplicates).replace(/"/g, '&quot;')})">Download List</button>
        `;
        resultsDiv.appendChild(libraryBox);
    });
}

function downloadDuplicates(libraryName, duplicates) {
    let content = `Duplicates in library: ${libraryName}\n`;
    content += `${'='.repeat(100)}\n\n`;
    
    for (const [key, paths] of Object.entries(duplicates)) {
        content += `Duplicate Set: ${key}\n`;
        content += `${'-'.repeat(80)}\n`;
        
        // Create table header
        content += `${'Movie Title'.padEnd(50)} | ${'Year'.padEnd(6)} | ${'Size'.padEnd(10)} | ${'Resolution'.padEnd(12)} | Full Path\n`;
        content += `${'-'.repeat(50)} | ${'-'.repeat(6)} | ${'-'.repeat(10)} | ${'-'.repeat(12)} | ${'-'.repeat(80)}\n`;
        
        // Add each duplicate file
        paths.forEach(({ path, year, size, resolution, originalName, itemId }) => {
            const formattedSize = formatFileSize(size);
            const movieTitle = originalName || 'Unknown';
            const displayTitle = movieTitle.length > 47 ? movieTitle.substring(0, 44) + '...' : movieTitle;
            const displayYear = year ? year.toString() : 'N/A';
            
            content += `${displayTitle.padEnd(50)} | ${displayYear.padEnd(6)} | ${formattedSize.padEnd(10)} | ${resolution.padEnd(12)} | ${path}\n`;
        });
        
        content += '\n';
    }
    
    // Add summary
    const totalDuplicates = Object.keys(duplicates).length;
    const totalFiles = Object.values(duplicates).reduce((sum, paths) => sum + paths.length, 0);
    content += `${'='.repeat(100)}\n`;
    content += `Summary: ${totalDuplicates} duplicate sets found with ${totalFiles} total files\n`;
    content += `${'='.repeat(100)}\n`;

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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setDefaultValues() {
    const embyServerUrlInput = document.getElementById('embyServerUrl');
    const apiKeyInput = document.getElementById('apiKey');
    
    // Load from localStorage only
    const savedUrl = localStorage.getItem('embyServerUrl');
    const savedApiKey = localStorage.getItem('embyApiKey');
    
    if (embyServerUrlInput) {
        if (savedUrl) {
            embyServerUrlInput.value = savedUrl;
        }
        
        // Save to localStorage when value changes
        embyServerUrlInput.addEventListener('blur', () => {
            if (embyServerUrlInput.value.trim()) {
                localStorage.setItem('embyServerUrl', embyServerUrlInput.value.trim());
            }
        });
    }
    
    if (apiKeyInput) {
        if (savedApiKey) {
            apiKeyInput.value = savedApiKey;
        }
        
        // Save to localStorage when value changes
        apiKeyInput.addEventListener('blur', () => {
            if (apiKeyInput.value.trim()) {
                localStorage.setItem('embyApiKey', apiKeyInput.value.trim());
            }
        });
    }
}

// Set default values when the page loads
document.addEventListener('DOMContentLoaded', setDefaultValues);

function showDuplicatesHTML(libraryName, duplicates) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.8);
        z-index: 1000;
        overflow-y: auto;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 30px;
        max-width: 1400px;
        margin: 0 auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        position: relative;
    `;
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
        position: absolute;
        top: 15px;
        right: 20px;
        background: #ff4757;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        font-size: 16px;
        cursor: pointer;
        font-weight: bold;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
    `;
    closeButton.onclick = () => document.body.removeChild(modal);
    
    // Create header
    const header = document.createElement('div');
    header.innerHTML = `
        <h2 style="margin: 0 0 20px 0; color: #2c3e50;">Duplicates in "${libraryName}"</h2>
        <p style="margin: 0 0 30px 0; color: #7f8c8d;">Found ${Object.keys(duplicates).length} duplicate sets with ${Object.values(duplicates).reduce((sum, paths) => sum + paths.length, 0)} total files</p>
    `;
    
    // Create duplicates container
    const duplicatesContainer = document.createElement('div');
    
    for (const [key, paths] of Object.entries(duplicates)) {
        // Create duplicate set container
        const duplicateSet = document.createElement('div');
        duplicateSet.style.cssText = `
            margin-bottom: 30px;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            overflow: hidden;
            background: #f8f9fa;
        `;
        
        // Create set header
        const setHeader = document.createElement('div');
        setHeader.style.cssText = `
            background: #3498db;
            color: white;
            padding: 15px 20px;
            font-weight: bold;
            font-size: 16px;
        `;
        setHeader.textContent = `Duplicate Set: ${key}`;
        
        // Create table
        const table = document.createElement('table');
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            background: white;
        `;
        
        // Create table header
        const tableHeader = document.createElement('thead');
        tableHeader.innerHTML = `
            <tr style="background: #f1f2f6;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #2c3e50;">Movie Title</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: 600; width: 80px; color: #2c3e50;">Year</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: 600; width: 100px; color: #2c3e50;">Size</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: 600; width: 120px; color: #2c3e50;">Resolution</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: 600; width: 80px; color: #2c3e50;">Quality</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd; font-weight: 600; color: #2c3e50;">File Path</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd; font-weight: 600; width: 100px; color: #2c3e50;">Action</th>
            </tr>
        `;
        
        // Create table body
        const tableBody = document.createElement('tbody');
        
        // Sort paths by resolution (highest first), then by size (largest first)
        const sortedPaths = paths.sort((a, b) => {
            const aPixels = a.resolution !== 'Unknown' ? 
                parseInt(a.resolution.split('x')[0]) * parseInt(a.resolution.split('x')[1]) : 0;
            const bPixels = b.resolution !== 'Unknown' ? 
                parseInt(b.resolution.split('x')[0]) * parseInt(b.resolution.split('x')[1]) : 0;
            
            if (aPixels !== bPixels) return bPixels - aPixels;
            return b.size - a.size;
        });
        
        sortedPaths.forEach((item, index) => {
            const { path, year, size, resolution, originalName, itemId } = item;
            const formattedSize = formatFileSize(size);
            const movieTitle = originalName || 'Unknown';
            const displayYear = year ? year.toString() : 'N/A';
            
            // Determine quality badge
            let qualityBadge = '';
            let qualityColor = '#95a5a6';
            
            if (resolution.includes('3840x2160')) {
                qualityBadge = '4K';
                qualityColor = '#e74c3c';
            } else if (resolution.includes('1920x1080')) {
                qualityBadge = '1080p';
                qualityColor = '#27ae60';
            } else if (resolution.includes('1280x720')) {
                qualityBadge = '720p';
                qualityColor = '#f39c12';
            } else if (resolution !== 'Unknown') {
                qualityBadge = 'SD';
                qualityColor = '#95a5a6';
            } else {
                qualityBadge = '?';
            }
            
            const row = document.createElement('tr');
            row.style.cssText = `
                ${index === 0 ? 'background: #e8f5e8;' : ''}
                ${index % 2 === 1 ? 'background: #f8f9fa;' : ''}
            `;
            
            const deleteButtonId = `delete-btn-${itemId}`;
            
            row.innerHTML = `
                <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500; color: #2c3e50;">${movieTitle}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; color: #2c3e50;">${displayYear}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; font-weight: 500; color: #2c3e50;">${formattedSize}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee; font-family: monospace; color: #2c3e50;">${resolution}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">
                    <span style="background: ${qualityColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">${qualityBadge}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #eee; font-family: monospace; font-size: 12px; color: #34495e; word-break: break-all;" title="${path}">${path}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #eee;">
                    <button id="${deleteButtonId}" style="
                        background: #e74c3c;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        font-size: 12px;
                        cursor: pointer;
                        font-weight: 500;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">
                        🗑️ Delete
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
            
            // Add click event listener for the delete button
            setTimeout(() => {
                const deleteBtn = document.getElementById(deleteButtonId);
                if (deleteBtn) {
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation();
                        deleteMovieFromEmby(itemId, movieTitle, row);
                    };
                }
            }, 0);
        });
        
        table.appendChild(tableHeader);
        table.appendChild(tableBody);
        
        duplicateSet.appendChild(setHeader);
        duplicateSet.appendChild(table);
        duplicatesContainer.appendChild(duplicateSet);
    }
    
    // Add download button
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download as Text File';
    downloadButton.style.cssText = `
        background: #2ecc71;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        margin-top: 20px;
        font-weight: 500;
    `;
    downloadButton.onclick = () => downloadDuplicates(libraryName, duplicates);
    
    // Assemble modal
    modalContent.appendChild(closeButton);
    modalContent.appendChild(header);
    modalContent.appendChild(duplicatesContainer);
    modalContent.appendChild(downloadButton);
    modal.appendChild(modalContent);
    
    // Add to page
    document.body.appendChild(modal);
    
    // Close on background click
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

function clearSavedData() {
    localStorage.removeItem('embyServerUrl');
    localStorage.removeItem('embyApiKey');
    
    // Clear the form fields
    const embyServerUrlInput = document.getElementById('embyServerUrl');
    const apiKeyInput = document.getElementById('apiKey');
    
    if (embyServerUrlInput) {
        embyServerUrlInput.value = '';
    }
    
    if (apiKeyInput) {
        apiKeyInput.value = '';
    }
    
    alert('Saved data cleared!');
}

function exportSettings() {
    const settings = {
        embyServerUrl: localStorage.getItem('embyServerUrl') || '',
        embyApiKey: localStorage.getItem('embyApiKey') || '',
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'emby-dupe-finder-settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const settings = JSON.parse(e.target.result);
                    
                    if (settings.embyServerUrl) {
                        localStorage.setItem('embyServerUrl', settings.embyServerUrl);
                        const urlInput = document.getElementById('embyServerUrl');
                        if (urlInput) urlInput.value = settings.embyServerUrl;
                    }
                    
                    if (settings.embyApiKey) {
                        localStorage.setItem('embyApiKey', settings.embyApiKey);
                        const keyInput = document.getElementById('apiKey');
                        if (keyInput) keyInput.value = settings.embyApiKey;
                    }
                    
                    alert('Settings imported successfully!');
                } catch (error) {
                    alert('Error importing settings: Invalid JSON file');
                }
            };
            reader.readAsText(file);
        }
    };
    
    input.click();
}

// Function to delete a movie from Emby library
async function deleteMovieFromEmby(itemId, movieTitle, rowElement) {
    const embyServerUrl = document.getElementById('embyServerUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value;
    
    if (!embyServerUrl || !apiKey) {
        alert('Emby server URL and API key are required for deletion');
        return;
    }
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${movieTitle}" from your Emby library?\n\nThis will remove the movie from Emby but may not delete the actual file from your NAS.`)) {
        return;
    }
    
    try {
        // Disable the delete button to prevent multiple clicks
        const deleteBtn = rowElement.querySelector('button');
        if (deleteBtn) {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Deleting...';
            deleteBtn.style.background = '#95a5a6';
        }
        
        let serverUrl = embyServerUrl;
        if (!/^https?:\/\//i.test(serverUrl)) {
            serverUrl = 'http://' + serverUrl;
        }
        
        // Clean up the server URL - remove trailing slashes
        serverUrl = serverUrl.replace(/\/+$/, '');
        
        // First, get the current user info to use for the delete request
        const userResponse = await fetch(`${serverUrl}/emby/Users?api_key=${apiKey}`);
        if (!userResponse.ok) {
            throw new Error('Failed to get user information');
        }
        const users = await userResponse.json();
        
        // Find an admin user or use the first user
        const user = users.find(u => u.Policy && u.Policy.IsAdministrator) || users[0];
        if (!user) {
            throw new Error('No user found for deletion operation');
        }
        
        // Construct the delete URL with user ID
        const deleteUrl = `${serverUrl}/emby/Items/${itemId}?api_key=${apiKey}&user=${user.Id}`;
        
        console.log('Attempting to delete:', deleteUrl); // Debug log
        
        const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Emby UserId="${user.Id}", Client="EmbyDupeFinder", Device="WebBrowser", DeviceId="emby-dupe-finder", Version="1.0.0"`
            }
        });
        
        console.log('Delete response status:', response.status); // Debug log
        
        if (response.ok) {
            // Success - remove the row from the table
            rowElement.style.transition = 'opacity 0.3s, transform 0.3s';
            rowElement.style.opacity = '0.5';
            rowElement.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                rowElement.remove();
                
                // Check if this was the last row in the duplicate set
                const table = rowElement.closest('table');
                const remainingRows = table.querySelectorAll('tbody tr').length;
                
                if (remainingRows === 0) {
                    // Remove the entire duplicate set if no movies remain
                    const duplicateSet = table.closest('div');
                    duplicateSet.style.transition = 'opacity 0.3s, transform 0.3s';
                    duplicateSet.style.opacity = '0';
                    duplicateSet.style.transform = 'scale(0.95)';
                    
                    setTimeout(() => {
                        duplicateSet.remove();
                        
                        // Update the header count
                        updateDuplicateCount();
                    }, 300);
                }
            }, 300);
            
            // Show success message
            showNotification(`"${movieTitle}" has been successfully deleted from Emby library`, 'success');
            
        } else if (response.status === 404) {
            showNotification(`Movie "${movieTitle}" was not found in Emby (may have already been deleted)`, 'warning');
            rowElement.remove();
        } else {
            // Get more details about the error
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorBody = await response.text();
                if (errorBody) {
                    console.log('Error response body:', errorBody); // Debug log
                    errorMessage += ` - ${errorBody}`;
                }
            } catch (e) {
                // Ignore if we can't read the error body
            }
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('Error deleting movie:', error);
        showNotification(`Failed to delete "${movieTitle}": ${error.message}`, 'error');
        
        // Re-enable the button on error
        const deleteBtn = rowElement.querySelector('button');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = '🗑️ Delete';
            deleteBtn.style.background = '#e74c3c';
        }
    }
}

// Function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = '#27ae60';
            break;
        case 'error':
            notification.style.background = '#e74c3c';
            break;
        case 'warning':
            notification.style.background = '#f39c12';
            break;
        default:
            notification.style.background = '#3498db';
    }
    
    notification.textContent = message;
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Allow manual dismissal by clicking
    notification.onclick = () => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };
}

// Function to update duplicate count in the modal header
function updateDuplicateCount() {
    const modal = document.querySelector('div[style*="position: fixed"]');
    if (modal) {
        const duplicatesContainer = modal.querySelector('div').children[1]; // Get duplicates container
        const remainingSets = duplicatesContainer.querySelectorAll('div[style*="margin-bottom: 30px"]').length;
        const totalFiles = duplicatesContainer.querySelectorAll('tbody tr').length;
        
        const header = modal.querySelector('h2').nextElementSibling;
        header.innerHTML = `Found ${remainingSets} duplicate sets with ${totalFiles} total files`;
        
        // If no duplicates remain, show completion message
        if (remainingSets === 0) {
            duplicatesContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #27ae60;">
                    <h3>🎉 All duplicates have been removed!</h3>
                    <p>You can close this window now.</p>
                </div>
            `;
        }
    }
}

function openEmby() {
    let embyServerUrl = document.getElementById('embyServerUrl').value.trim();
    
    if (!embyServerUrl) {
        alert('Please enter an Emby Server URL first');
        return;
    }
    
    // Add http:// if no protocol specified
    if (!/^https?:\/\//i.test(embyServerUrl)) {
        embyServerUrl = 'http://' + embyServerUrl;
    }
    
    // Open Emby in a new tab
    window.open(embyServerUrl, '_blank');
}