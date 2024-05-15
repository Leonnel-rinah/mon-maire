import puppeteer from 'puppeteer-core';
import { createObjectCsvWriter } from 'csv-writer';

// Définition de la fonction principale comme une fonction asynchrone
let main = async () => {
    try {
        // j'initialize et lance Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        });

        // Cette fonction me permet d'ouvrir chrome surn un nouvel onglet... S'ouvre uniquement si { headless: false }
        const page = await browser.newPage();

        // URL de la page contenant les données sur les régions
        const regionUrl = 'https://www.mon-maire.fr/maires-regions';

        // Définir la taille de la fenêtre d'affichage
        await page.setViewport({
            width: 1680,
            height: 1050,
            deviceScaleFactor: 1
        });

        // Naviguer vers l'URL de la région
        await page.goto(regionUrl, { waitUntil: 'networkidle2' });

        // Extraire les données de la région de la page, Nom et Url de la riegion deje disponible a ce niveau.
        const regionList: any = await page.evaluate(() => {
            const regionArray = Array.from(document.querySelectorAll('.list-group-item a'));
            // Je mappe chque object pour avoir uniquement la region et le url
            return regionArray.map((region: any) => ({
                Région: region.innerText,
                Url: region.href
            }));
        });

        // je loupe a travert chaque region pour extraire le nom de la vile, le nom du maire,
        for (const region of regionList) {
            // Naviguer vers l'URL de la ville
            await page.goto(region.Url, { waitUntil: 'networkidle2' });

            const data = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('ul.list-group li'));
                return items.map((item: any) => {
                    const text = item.textContent.trim();
                    const href = item.querySelector('ul.list-group li a').href
                    return {
                        Ville: text.split(')', 2)[0] + ')',
                        Maire: text.split(')', 2)[1].replace('-', "").trim(),
                        Murl: href
                    };
                });
            });

            // JE mets a jour une fois les donnees extraites
            region.Ville = data[0].Ville;
            region["Nom du maire"] = data[0].Maire;

            // Navigue vers l'URL du maire
            await page.goto(data[0].Murl, { waitUntil: 'networkidle2' });

            // Extraction des coordonnées  de la mairie  tel que le telephone, email, address
            const contactDet = await page.evaluate(() => {
                const email = Array.from(document.querySelectorAll('span[itemprop="email"]'))
                const tel = Array.from(document.querySelectorAll('span[itemprop="telephone"]'));
                const townName = Array.from(document.querySelectorAll('span[itemprop="name"]'));
                const address = Array.from(document.querySelectorAll('span[itemprop="streetAddress"]'));
                const postalCode = Array.from(document.querySelectorAll('span[itemprop="postalCode"]'));
                const locality = Array.from(document.querySelectorAll('span[itemprop="addressLocality"]'));
                const paragraphs = Array.from(document.querySelectorAll('div.post-content p'));
                const text = paragraphs.map(p => p.textContent).find(m => m?.includes('que maire le'))?.split('\n', 2)[1]

                const dateCheck = /\b(\d{2}\/\d{2}\/\d{4})\b/g;

                // Extraire la date en utilisant l'expression régulière
                const match = text?.match(dateCheck);

                const dateDePriseDeFonction = match ? match[0] : null;

                const fullAddress = townName.map(t => t.textContent)[0] + ', ' +
                    address.map(a => a.textContent)[0] + ', ' +
                    postalCode.map(p => p.textContent)[0] + ', ' +
                    locality.map(l => l.textContent)[0]

                return {
                    Email: email.map(e => e.textContent)[0],
                    Téléphone: tel.map(t => t.textContent)[0],
                    Address: fullAddress,
                    priseDeFonction: dateDePriseDeFonction
                }
            });

            // Mettre à jour les données de la région avec les détails de contact du maire
            region["Date de prise de fonction"] = contactDet.priseDeFonction;
            region.Téléphone = contactDet.Téléphone;
            region.Email = contactDet.Email;
            region["Address mairie"] = contactDet.Address;
        }

        // J'exclus Url
        const modifiedRegionList = regionList.map((r: any) => {
            let { Url, ...newR } = r;
            return newR;
        });

        // Définir les en-têtes CSV basés sur les clés des données de la région
        const headers = Object.keys(modifiedRegionList[0]).map(key => ({ id: key, title: key }));

        const csvWriter = createObjectCsvWriter({
            path: 'mon_maire_scrapped.csv',
            header: headers
        });


        // Écrire les données de la région dans le fichier CSV
        csvWriter.writeRecords(modifiedRegionList)
            .then(() => {
                console.log('Fichier CSV créé avec succès!');
            })
            .catch((err) => {
                console.error('Erreur lors de l\'écriture du CSV:', err);
            });


        await browser.close()

    } catch (error) {
        console.error(error);
    }
}

// Exécuter la fonction principale
main();
