import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, mergeDocuments } from '@gltf-transform/functions';
import fs from 'fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const ANIMS_FILES = [
    {k:'WALK',   f:'ANIMACIONES/CAMINANDO.glb'},
    {k:'IDLE',   f:'ANIMACIONES/HABLANDO.glb'},
    {k:'SOFT',   f:'ANIMACIONES/GOLPE SIMPLE.glb'},
    {k:'HARD',   f:'ANIMACIONES/GOLPE DURO.glb'},
    {k:'FALL',   f:'ANIMACIONES/GOLPE Y CAE.glb'},
    {k:'GND',    f:'ANIMACIONES/TIRADO EN EL SUELO .glb'},
    {k:'GETUP',  f:'ANIMACIONES/LEVANTANDOSE DESPUES DE CAIDA .glb'},
    {k:'BLEG',   f:'ANIMACIONES/SUPLICANDO.glb'},
    {k:'BOW',    f:'ANIMACIONES/REVERENCIA.glb'},
    {k:'NO',     f:'ANIMACIONES/NO CON LA CABEZA.glb'},
    {k:'SALTO',  f:'ANIMACIONES/SALTO TIJERA.glb'},
    {k:'BACKFLIP',  f:'ANIMACIONES/BACKFLIP.glb'},
    {k:'VOLTERETA', f:'ANIMACIONES/VOLTERETA .glb'},
    {k:'MIGAJA',    f:'ANIMACIONES/ARRASTRADO POR EL PISO.glb'},
    {k:'MOSTRAR',   f:'ANIMACIONES/mostrar.glb'},
    {k:'LAG',       f:'ANIMACIONES/LAGARTIJA.glb'},
    {k:'DANCE',     f:'ANIMACIONES/BAILANDO.glb'},
    {k:'CONF',      f:'ANIMACIONES/CONFUSO.glb'}
];

async function mergeAnims() {
    console.log(`[1/${ANIMS_FILES.length}] Cargando modelo base: ${ANIMS_FILES[0].f}`);
    const doc = await io.read(ANIMS_FILES[0].f);
    
    // Rename base animation
    const baseAnims = doc.getRoot().listAnimations();
    if(baseAnims.length > 0) baseAnims[0].setName(ANIMS_FILES[0].k);

    // Save references to the base nodes by name (Mixamo assigns names like 'mixamorig:RightHand')
    const baseNodesCount = doc.getRoot().listNodes().length;

    // Process the rest of the animations
    for (let i = 1; i < ANIMS_FILES.length; i++) {
        const entry = ANIMS_FILES[i];
        console.log(`[${i+1}/${ANIMS_FILES.length}] Agregando clip: ${entry.k}`);
        
        try {
            const tempDoc = await io.read(entry.f);
            const tempNodes = tempDoc.getRoot().listNodes();
            
            // Guardar indices de nodos objetivo ANTES del merge
            const tempAnim = tempDoc.getRoot().listAnimations()[0];
            if (!tempAnim) continue;
            
            const originalTargetIndices = [];
            for (const ch of tempAnim.listChannels()) {
                const targetNode = ch.getTargetNode();
                originalTargetIndices.push(tempNodes.indexOf(targetNode));
            }

            // Merge brings all scenes, nodes, animations, meshes into `doc`
            mergeDocuments(doc, tempDoc);
            
            const allAnimations = doc.getRoot().listAnimations();
            const importedAnim = allAnimations[allAnimations.length - 1];
            importedAnim.setName(entry.k);

            // Re-target all channels of the newly imported animation to our BASE nodes by INDEX
            let validChannels = 0;
            const channels = importedAnim.listChannels();
            const baseNodes = doc.getRoot().listNodes().slice(0, baseNodesCount);
            
            for (let c = 0; c < channels.length; c++) {
                const channel = channels[c];
                const nodeIndex = originalTargetIndices[c];
                if(nodeIndex >= 0 && nodeIndex < baseNodes.length) {
                    // Point channel to base node
                    channel.setTargetNode(baseNodes[nodeIndex]);
                    validChannels++;
                }
            }
            console.log(`   -> OK: ${validChannels} huesos vinculados.`);

            // Cleanup: Destroy the imported Scene to orphan all duplicate meshes/nodes
            const allScenes = doc.getRoot().listScenes();
            const importedScene = allScenes[allScenes.length - 1];
            
            // Forzamos que se deseche la escena duplicada
            importedScene.dispose();

        } catch(err) {
            console.error(`   -> Error importando ${entry.k}:`, err.message);
        }
    }

    console.log("Limpiando 17 copias basura del personaje...");
    // Prune removes all nodes, meshes, and materials that are not in an active Scene OR targeted by an active Animation
    await doc.transform(
        prune(),
        dedup()
    );
    
    const finalSizeEstimate = JSON.stringify(doc).length / 1024 / 1024;
    console.log(`Exportando maestro optimizado...`);
    
    // El formato GLB exige un solo buffer de datos binarios. Unimos todos los buffers.
    const root = doc.getRoot();
    const primaryBuffer = root.listBuffers()[0];
    root.listAccessors().forEach((a) => a.setBuffer(primaryBuffer));
    root.listBuffers().forEach((b, i) => i > 0 && b.dispose());

    const outPath = 'ANIMACIONES/MASTER.glb';
    await io.write(outPath, doc);
    
    console.log("¡Hecho! Se creó ANIMACIONES/MASTER.glb exitosamente.");
}

mergeAnims().catch(e => console.error(e));
