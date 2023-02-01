# whimsical-exporter

CLI tool to export your [Whimsical](https://whimsical.com) boards recursively as SVG files from a starting folder URL.

## Requirements

- Node.js v16+
- Whimsical account with password ([how to create one if you sign in with Google](https://help.whimsical.com/article/582-how-to-change-or-reset-your-password))
- Can run a headless browser (uses Chromium via Puppeteer)

## Usage

You can just run the latest version from the terminal, without installing it locally:

```shell
npx whimsical-exporter
```

The interactive tool will ask you for your email, password, and the URL you want to start exporting from, and will save the files with the same structure in a `downloads` folder on your working directory.

## License

© Rodrigo Fernández, MIT license.
