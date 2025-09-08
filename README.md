# Emby Duplicate Finder

## Overview

This project is a web-based tool designed to help Emby users identify duplicates in their media libraries. It now supports both Movies and TV Series (Episodes). I created this tool after facing a small yet frustrating issue with duplicates in my Emby setup.

The tool helps identify duplicates such as:

- **Same media with multiple files**: When you have two or more files of the same movie or episode in your library.
- **Misidentified items**: When Emby mistakenly identifies one item as another.

## How It Works

The Emby Duplicate Finder is easy to use and works in any environment. Provide your Emby server URL and an API key. The tool will scan your movie and series libraries for duplicates.

- For Movies: it compares movie names and production years (with a path-year fallback).
- For Series: it groups Episodes by Series name + Season + Episode number (falls back to title/index when required).

If duplicates are found, the tool displays them grouped by Emby library and provides options to view details, delete items from Emby, or download a text list showing each media title and file path. This makes it easy to review and manage duplicates directly from your browser.

## Features

- **Simple Setup**: No complex configurations required. Just enter your Emby server URL and API key.
- **Cross-Platform**: Works in any environment with a modern web browser.
- **Duplicate Detection**: Identifies duplicates for Movies (name + year) and Series (series + season + episode).
- **Downloadable Results**: Provides an option to download a list of duplicates, showing titles and file paths.
- **Open Source**: The project is open-source, allowing anyone to contribute or modify the code as needed.

## Try It Out

You can try out the Emby Duplicate Finder here:
[https://imahmud1.github.io/emby-dupe-finder/](https://imahmud1.github.io/emby-dupe-finder/)

## Contributing

If you're interested in tinkering with the code or contributing to the project, visit the GitHub repository:
[https://github.com/imahmud1/emby-dupe-finder](https://github.com/imahmud1/emby-dupe-finder)

Feel free to fork the repository, submit issues, or create pull requests!

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
