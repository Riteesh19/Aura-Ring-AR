const fs = require('fs');
let code = fs.readFileSync('src/utils/calibration.ts', 'utf-8');

const debugCode = `
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const redSphere = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 16), redMat);
    redSphere.position.set(0, 0, 0);
    this.scene.add(redSphere);

    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const greenSphere = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 16), greenMat);
    greenSphere.position.set(0, -200, 0);
    this.scene.add(greenSphere);

    const blueMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const blueSphere = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 16), blueMat);
    blueSphere.position.set(200, 0, 0);
    this.scene.add(blueSphere);
    
    console.log("Canvas size:", this.threeCanvas.clientWidth, this.threeCanvas.clientHeight);
`;

code = code.replace(/this\.scene\.add\(this\.ringGroup\);/, "this.scene.add(this.ringGroup);\n" + debugCode);
fs.writeFileSync('src/utils/calibration.ts', code);
