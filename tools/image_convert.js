const FileType = require('file-type');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
 
(async () => {
    const imgDir = path.resolve(__dirname, '..', 'source', 'img', 'why-use-static-types-in-js');
    const fileList = fs.readdirSync(imgDir);
    fileList.forEach(async (file) => {
        if (/.*\.png/.test(file)) {
            const filePath = path.resolve(imgDir, file);
            const meta = await FileType.fromFile(filePath);
            console.log(file, meta);
            if (meta.mime === 'image/webp') {
                await sharp(filePath).toFile(path.resolve(__dirname, 'output', file));
            }
        }
    })
})();