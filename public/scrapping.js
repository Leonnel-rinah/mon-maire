"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const csv_writer_1 = require("csv-writer");
// Définition de la fonction principale comme une fonction asynchrone
let main = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // j'initialize et lance Puppeteer
        const browser = yield puppeteer_core_1.default.launch({
            headless: true,
            executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        });
        // Cette fonction me permet d'ouvrir chrome surn un nouvel onglet... S'ouvre uniquement si { headless: false }
        const page = yield browser.newPage();
        // URL de la page contenant les données sur les régions
        const regionUrl = 'https://www.mon-maire.fr/maires-regions';
        // Définir la taille de la fenêtre d'affichage
        yield page.setViewport({
            width: 1680,
            height: 1050,
            deviceScaleFactor: 1
        });
        // Naviguer vers l'URL de la région
        yield page.goto(regionUrl, { waitUntil: 'networkidle2' });
        // Extraire les données de la région de la page, Nom et Url de la riegion deje disponible a ce niveau.
        const regionList = yield page.evaluate(() => {
            const regionArray = Array.from(document.querySelectorAll('.list-group-item a'));
            // Je mappe chque object pour avoir uniquement la region et le url
            return regionArray.map((region) => ({
                Région: region.innerText,
                Url: region.href
            }));
        });
        // je loupe a travert chaque region pour extraire le nom de la vile, le nom du maire,
        for (const region of regionList) {
            // Naviguer vers l'URL de la ville
            yield page.goto(region.Url, { waitUntil: 'networkidle2' });
            const data = yield page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('ul.list-group li'));
                return items.map((item) => {
                    const text = item.textContent.trim();
                    const href = item.querySelector('ul.list-group li a').href;
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
            yield page.goto(data[0].Murl, { waitUntil: 'networkidle2' });
            // Extraction des coordonnées  de la mairie  tel que le telephone, email, address
            const contactDet = yield page.evaluate(() => {
                var _a;
                const email = Array.from(document.querySelectorAll('span[itemprop="email"]'));
                const tel = Array.from(document.querySelectorAll('span[itemprop="telephone"]'));
                const townName = Array.from(document.querySelectorAll('span[itemprop="name"]'));
                const address = Array.from(document.querySelectorAll('span[itemprop="streetAddress"]'));
                const postalCode = Array.from(document.querySelectorAll('span[itemprop="postalCode"]'));
                const locality = Array.from(document.querySelectorAll('span[itemprop="addressLocality"]'));
                const paragraphs = Array.from(document.querySelectorAll('div.post-content p'));
                const text = (_a = paragraphs.map(p => p.textContent).find(m => m === null || m === void 0 ? void 0 : m.includes('que maire le'))) === null || _a === void 0 ? void 0 : _a.split('\n', 2)[1];
                const dateCheck = /\b(\d{2}\/\d{2}\/\d{4})\b/g;
                const match = text === null || text === void 0 ? void 0 : text.match(dateCheck);
                const dateDePriseDeFonction = match ? match[0] : null;
                const fullAddress = townName.map(t => t.textContent)[0] + ', ' +
                    address.map(a => a.textContent)[0] + ', ' +
                    postalCode.map(p => p.textContent)[0] + ', ' +
                    locality.map(l => l.textContent)[0];
                return {
                    Email: email.map(e => e.textContent)[0],
                    Téléphone: tel.map(t => t.textContent)[0],
                    Address: fullAddress,
                    priseDeFonction: dateDePriseDeFonction
                };
            });
            // Mettre à jour les données de la région avec les détails de contact du maire
            region["Date de prise de fonction"] = contactDet.priseDeFonction;
            region.Téléphone = contactDet.Téléphone;
            region.Email = contactDet.Email;
            region["Adresse mairie"] = contactDet.Address;
        }
        // J'exclus Url
        const modifiedRegionList = regionList.map((r) => {
            let { Url } = r, newR = __rest(r, ["Url"]);
            return newR;
        });
        // Définir les en-têtes CSV basés sur les clés des données de la région
        const headers = Object.keys(modifiedRegionList[0]).map(key => ({ id: key, title: key }));
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
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
        yield browser.close();
    }
    catch (error) {
        console.error(error);
    }
});
// Exécuter la fonction principale
main();
