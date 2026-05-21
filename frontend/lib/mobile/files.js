import { isNativeMobileApp } from './database';

function base64FromDataUri(dataUri) {
    return dataUri.split(',')[1];
}

export async function savePdfDocument(doc, filename) {
    if (!isNativeMobileApp()) {
        doc.save(filename);
        return { message: 'PDF downloaded!' };
    }

    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
    ]);

    const data = base64FromDataUri(doc.output('datauristring'));
    const saved = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Documents,
        recursive: true,
    });

    if (saved.uri) {
        await Share.share({
            title: filename,
            text: 'FactoryOS PDF report',
            url: saved.uri,
            dialogTitle: 'Save or share PDF',
        }).catch(() => undefined);
    }

    return { message: 'PDF saved. Use the share sheet to save/send it.' };
}

