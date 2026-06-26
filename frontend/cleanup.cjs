const fs = require('fs');
let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

// Remove spheres
code = code.replace(/const redMat = new THREE\.MeshBasicMaterial[^;]+;/g, '');
code = code.replace(/const redSphere = new THREE\.Mesh[^;]+;/g, '');
code = code.replace(/redSphere\.position\.set[^;]+;/g, '');
code = code.replace(/this\.scene\.add\(redSphere\);/g, '');

code = code.replace(/const greenMat = new THREE\.MeshBasicMaterial[^;]+;/g, '');
code = code.replace(/const greenSphere = new THREE\.Mesh[^;]+;/g, '');
code = code.replace(/greenSphere\.position\.set[^;]+;/g, '');
code = code.replace(/this\.scene\.add\(greenSphere\);/g, '');

code = code.replace(/const blueMat = new THREE\.MeshBasicMaterial[^;]+;/g, '');
code = code.replace(/const blueSphere = new THREE\.Mesh[^;]+;/g, '');
code = code.replace(/blueSphere\.position\.set[^;]+;/g, '');
code = code.replace(/this\.scene\.add\(blueSphere\);/g, '');

code = code.replace(/console\.log\("Canvas size:"[^;]+;/g, '');
code = code.replace(/console\.log\("Ring Position:"[^;]+;/g, '');

fs.writeFileSync('src/utils/calibration.ts', code);
