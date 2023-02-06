# whimsical-exporter

CLI tool to export your [Whimsical](https://whimsical.com) boards recursively as SVG, PNG, or PDF from a starting folder URL.

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

## License

© Rodrigo Fernández, MIT license.
