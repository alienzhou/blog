const FileType = require('file-type');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
 
(async () => {
    const imgDir = path.resolve(__dirname, '..', 'source', 'img');
    const fileList = fs.readdirSync(imgDir);
    console.log(fileList);
    fileList.forEach(async (file) => {
        if (/16[0-9a-zA-z]+\.png/.test(file)) {
            const filePath = path.resolve(imgDir, file);
            const meta = await FileType.fromFile(filePath);
            if (meta.mime === 'image/webp') {
                await sharp(filePath).toFile(path.resolve(__dirname, 'output', file));
            }
        }
    })
})();