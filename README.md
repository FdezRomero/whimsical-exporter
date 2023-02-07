# whimsical-exporter

CLI tool to export your [Whimsical](https://whimsical.com) boards recursively as SVG, PNG, or PDF from a starting folder URL.

## Features

- Exports folders and boards recursively, keeping the same folder structure.
- Allows selecting the exporting formats:
  - PNG at 2x zoom (static image, shapes cannot be edited)
  - PDF (landscape, shapes can be zoomed in)
  - SVG (shapes can be zoomed in and edited)
- If the process fails, you can run the same command again and it will skip existing files.
- Automatically skips empty boards.
- All code is run locally in your machine using a headless Chromium browser.
- Your login credentials are never stored or shared.

## Requirements

- Node.js v16+
- Whimsical account with password ([how to create one if you sign in with Google](https://help.whimsical.com/article/582-how-to-change-or-reset-your-password))
- Can run a headless browser (uses Chromium via Puppeteer)

## Usage

You can just run the latest version from the terminal, without installing it locally:

```shell
npx whimsical-exporter
```

Or clone the repo and install the dependencies with `npm install`, then run it with `npm start`.

The interactive tool will ask you for your email, password, the URL you want to start exporting from, and the image formats you prefer and will save the files with the same folder structure in a `downloads` folder on your working directory.

If you plan to run this tool several times, you can also pass these options as environment variables:

```
EMAIL='username@domain.tld' PASSWORD='your_password' FOLDER_URL='https://whimsical.com/your-folder-name' FILE_TYPES='svg,png,pdf' npx whimsical-exporter
```

If you would like to debug the tool, you can make the browser automation visible and open the dev tools panel with the `DEBUG` environment variable. Please note that you may get print dialogs that will steal your focus when exporting to PDF on this mode:

```
DEBUG=true npx whimsical-exporter
```

## License

© Rodrigo Fernández, MIT license.
