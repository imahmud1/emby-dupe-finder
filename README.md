# Emby Duplicate Movie Finder

## Overview

This is an enhanced fork of a web-based tool designed to help Emby users identify and manage duplicate movies in their media libraries. The tool addresses common issues with duplicate files, whether they're multiple copies of the same movie or misidentified entries in your library.

## Key Features

### 🔍 Smart Duplicate Detection

- **Intelligent Algorithm**: Uses exact name and year matching to identify true duplicates while avoiding false positives with sequels and remakes
- **Path-Based Year Detection**: Extracts year information from file paths for more accurate duplicate detection
- **Quality Analysis**: Shows resolution, file size, and quality indicators (4K, 1080p, 720p, SD) for each duplicate

### 📊 Rich Visual Interface

- **Interactive Modal View**: View duplicates in a beautiful, detailed table format with quality badges
- **Sortable Results**: Duplicates are automatically sorted by resolution and file size (best quality first)
- **Color-Coded Quality Badges**: Instantly identify 4K, 1080p, 720p, and SD content
- **Responsive Design**: Modern UI with smooth animations and transitions

### 🗑️ Direct Delete Functionality

- **In-App Deletion**: Delete duplicate movies directly from the web interface
- **Smart Confirmation**: Confirms deletion before removing items
- **Real-Time Updates**: Interface updates immediately after deletion
- **Success Notifications**: Toast notifications provide feedback on operations

### 💾 Persistent Settings

- **Auto-Save**: Server URL and API key are automatically saved to local storage
- **Quick Access**: No need to re-enter credentials on each visit

### 📥 Export Options

- **Detailed Text Reports**: Download comprehensive duplicate reports with file paths, sizes, resolutions, and years
- **Formatted Tables**: Reports include ASCII tables for easy reading
- **Summary Statistics**: Each report includes total duplicate counts and file statistics

### 🔄 Library Management

- **Refresh Library**: Trigger a full Emby library refresh directly from the interface
- **Open Emby**: Quick access button to open your Emby server in a new tab
- **Multi-Library Support**: Scans all movie libraries automatically

### 🎨 Enhanced UI/UX

- **Form Labels**: Clear labels above input fields for better usability
- **Improved Placeholders**: More descriptive placeholder text
- **Loading Overlay**: Visual feedback during long operations
- **Celebration Messages**: Encouraging messages when no duplicates are found
- **Dark Theme**: Modern dark interface with accent colors

## How It Works

1. Enter your Emby server URL (e.g., `localhost:8096`, `192.168.1.100:8096`, or `mydomain.com`)
2. Provide your Emby API key
3. Click "Find Duplicate Movies" to scan your libraries
4. Review duplicates in the interactive modal view
5. Delete unwanted copies directly from the interface or download a report for manual review

The tool automatically:

- Detects `http://` protocol if not specified
- Saves your credentials for future use
- Sorts duplicates by quality (highest resolution and largest file first)
- Updates the interface in real-time as you delete items

## Improved Duplicate Detection Algorithm

This fork features an enhanced detection algorithm that:

- Uses exact name and year matching to prevent false positives
- Extracts year information from file paths for better accuracy
- Avoids grouping sequels or different movies together
- Normalizes movie names while preserving important information
- Filters quality indicators without losing movie identity

## Technical Improvements

- **Enhanced Error Handling**: Better error messages and graceful failure handling
- **API Integration**: Full integration with Emby's REST API for deletion operations
- **LocalStorage Persistence**: Automatic saving and loading of user preferences
- **Modular Code**: Well-organized functions for easy maintenance and extension
- **Console Utilities**: Additional functions for advanced users (export/import settings)

## Browser Compatibility

Works in all modern browsers that support:

- ES6+ JavaScript
- LocalStorage API
- Fetch API
- CSS Grid and Flexbox

## Usage Tips

- **Quality Comparison**: The interface automatically highlights the best quality copy (green background)
- **Batch Operations**: Review all duplicates before deleting to make informed decisions
- **Backup First**: Consider downloading the duplicate report before deleting files
- **NAS Users**: Note that deletion removes items from Emby; actual file deletion depends on your NAS/server settings

## Credits

This is a fork and enhancement of the original Emby Duplicate Finder by [imahmud1](https://github.com/imahmud1/emby-dupe-finder).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
