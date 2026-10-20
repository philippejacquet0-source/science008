# Qualité des eaux des forages — science008

[Application](https://philippejacquet0-source.github.io/science008/) · [Dépôt](https://github.com/philippejacquet0-source/science008) · [Application sœur : les rivières](https://philippejacquet0-source.github.io/science007/)

Application statique française pour explorer la qualité des eaux souterraines à partir des données publiques **ADES**, diffusées par **Hub’Eau**. Elle reprend les interactions et le style de science007 : carte, recherche locale, sélection multiple, courbes et export CSV.

## Utilisation

- Rechercher une commune, un code BSS, un ouvrage ou un aquifère ; Entrée centre la carte sur les résultats.
- Les **forages** sont affichés par défaut. Le menu permet aussi les puits, les sources ou tous les types. Les filtres portent sur le bassin, le territoire et la profondeur d’investigation déclarée.
- Le filtre de suivi récent conserve les points dont la dernière date de suivi du catalogue est postérieure au début de la période. Cette date concerne **tous les paramètres confondus** : ce filtre ne garantit pas la présence des paramètres choisis dans la période. Les analyses exactes sont vérifiées à leur chargement.
- Clic : sélectionner un point. Maj + clic ou bouton Comparer : ajouter / retirer. Maj + glisser ou bouton Rectangle : ajouter une zone. Toute la sélection reste conservée ; les courbes se chargent par groupes de **12 points**. La liste sous la carte permet de choisir les points superposés.
- Chercher un aquifère BDLISA pour filtrer ses points associés. Le bouton de comparaison sélectionne les points de cet aquifère présents dans la vue de la carte. Un point peut être associé à plusieurs entités : la fiche les liste toutes, la couleur utilise le premier code déclaré.
- La fiche donne la nature, les identifiants, la profondeur connue, le mode de gisement et les aquifères. La profondeur est celle de l’investigation : elle ne décrit ni la crépine ni la profondeur d’un prélèvement.
- Choisir des paramètres et une période charge automatiquement les courbes. Le bouton **Charger les analyses** force une requête actualisée à Hub’Eau.
- **Voir un paramètre à une date** utilise la sélection entière, indépendamment de la période des courbes. Choisir la date, l’écart accepté et, si nécessaire, l’unité/fraction. Le prélèvement réel le plus proche est retenu ; à égalité, le plus ancien. Aucune interpolation. La légende représente une concentration, sans classement sanitaire.
- **Comparer les points sélectionnés** affiche les moyennes arithmétiques, minimum, maximum, effectifs et périodes réelles pour le groupe de points des courbes. Les moyennes utilisent uniquement les résultats quantifiés uniques ; les autres sont exclus et comptés. Les fréquences d’échantillonnage peuvent différer.
- L’export CSV contient toutes les analyses chargées du groupe affiché, avec les identifiants, la précision publique, la profondeur, les aquifères, la date complète, l’unité, la fraction, les seuils analytiques et la qualification. Le tableau HTML affiche au maximum 2 000 lignes et le signale ; le CSV conserve toutes les lignes.
- Sélection, paramètres, période et filtres sont conservés dans l’URL. Le lien peut être partagé ou rechargé.

## Données et précision

L’instantané initial annonce **82 362 points ADES** à la source. La collecte vérifiée par département contient **82 340 points géolocalisés**, dont **44 314 forages**. Les 22 points sans département exploitable ne sont pas inclus dans la carte. Les comptes exacts par département sont conservés dans le catalogue. Ils ne représentent pas un recensement exhaustif des ouvrages français : seuls les points du catalogue qualité ADES sont concernés.

La collecte départementale évite la limite de profondeur de pagination de l’API et vérifie chaque compte avant de préparer l’instantané. Les coordonnées et les métadonnées sont conservées sans arrondi ajouté. Les tableaux de chaînes répétées sont compactés dans des dictionnaires ; la carte utilise un canvas et un index spatial.

**Localisation des captages d’eau potable :** le code de précision Sandre **18** correspond à une position publique au chef-lieu de la commune. Ces symboles ne représentent pas l’emplacement réel de l’ouvrage. Les coordonnées publiées sont conservées ; aucune position confidentielle n’est recherchée ou reconstituée. Le code 0 correspond à une précision non renseignée. Des captages peuvent se superposer et restent accessibles dans la liste.

24 paramètres : nitrates, pH, conductivité à 25 °C, température, ammonium, turbidité, carbone organique total (COT), chlorures, sulfates, calcium, magnésium, sodium, dureté totale (TH), titre alcalimétrique complet (TAC), fer, manganèse, arsenic, nickel, plomb, atrazine, atrazine déséthyl, glyphosate, AMPA et métolachlore total. Les codes et libellés ont été vérifiés contre l’API. La disponibilité dépend des programmes de suivi ; aucune couverture uniforme n’est présumée.

La présélection **Usuels** propose 10 paramètres : nitrates, pH, conductivité, température, fer, manganèse, dureté, TAC, turbidité et COT. Les liens contenant une sélection explicite de paramètres la conservent ; cliquer sur Usuels applique cette nouvelle sélection.

Le **COT (1841)** est limité aux analyses de la fraction **Eau brute (23)**. Les mesures sur eau filtrée, correspondant au carbone organique dissous, sont exclues de ce paramètre. Sa requête est séparée de celles des autres paramètres afin de conserver les différentes fractions de ces derniers. La dureté et le TAC sont les résultats déclarés dans ADES, sans calcul à partir du calcium ou du magnésium.

Les analyses retenues portent la qualification source **Correcte (1)**. Le statut et les remarques sont conservés. Les unités et fractions distinctes restent séparées. Les résultats sous ou au-dessus d’un seuil sont représentés comme des limites, jamais comme des concentrations exactes. Le code « présence » reste une indication. L’absence de mesure ne vaut pas zéro.

Les données décrivent l’eau prélevée aux points de suivi. Le site ne calcule pas de note sanitaire et ne délivre aucune attestation de potabilité. Les rattachements BDLISA ne démontrent pas une connexion hydraulique entre points.

Un exemple local comprend **1 089 analyses réelles** depuis 2021 sur trois forages de Meurthe-et-Moselle : **Jaulny (BSS000MCQE), Colombey-les-Belles (BSS000UPPG) et Villers-la-Montagne (BSS000HPVL)**. Le bouton de découverte sélectionne Jaulny ; ajouter les autres par recherche pour comparer. Les résultats locaux sont explicitement étiquetés. Le bouton de chargement permet de demander la version actuelle à Hub’Eau.

## Ouvrir et reconstruire

Ouvrir `dist/index.html` directement, ou double-cliquer sur `start-local.cmd`. Les scripts classiques, bibliothèques, contours, catalogue et exemple sont embarqués : aucun chargement de fichier local avec fetch n’est nécessaire. Internet reste nécessaire pour les fonds IGN et les nouvelles analyses. OpenStreetMap est proposé sur HTTP/HTTPS ; un fond local est disponible en cas d’échec des tuiles.

Node.js 24 suffit, aucune installation de dépendances.

```text
npm start
npm run build
npm test
node scripts/check-static.mjs
```

Le serveur utilise normalement `http://127.0.0.1:4184/`. Variable optionnelle : `FORAGES_PORT`. Il prend en charge gzip et ETag.

Pour actualiser les données :

```text
npm run sync-data
npm run build
npm test
```

La collecte garde ses réponses départementales dans `qa/cache/` (ignoré par Git). Pour une collecte entièrement fraîche, utiliser un dossier `qa/cache/` vide. La source de travail non compactée est `qa/stations.json`. Le build du dépôt et de GitHub Pages utilise le catalogue compact versionné lorsqu’elle n’est pas présente ; il ne dépend pas d’un accès à l’API pendant le déploiement.

Les analyses sont paginées, puis découpées par période au-delà de 20 000 résultats. Si une journée déborde, le découpage continue par points et paramètres. Un débordement irréductible ou une réponse incomplète déclenche une erreur explicite. Les requêtes obsolètes sont annulées. Le CSV protège les textes susceptibles d’être interprétés comme des formules.

## Publication et vérification

Le workflow GitHub Actions prépare le bundle, exécute les tests, vérifie les ressources puis publie `dist/` sur GitHub Pages à chaque push sur `main`. Le catalogue est un instantané versionné.

Les 17 tests couvrent la conservation du catalogue, les filtres, les dates réelles, la précision communale, les seuils, la séparation des unités/fractions, la déduplication, les moyennes, la vue par date, la pagination et les débordements. Le COT sur eau brute est vérifié sans exclure les autres fractions des autres paramètres. Dans le navigateur, les appels ADES réels, la comparaison de deux forages et la vue par date ont été vérifiés. L’affichage mobile à 390 px ne présente pas de débordement horizontal et replie les filtres. Le déclenchement de l’export a été observé sans erreur JavaScript ; la réception du fichier par le navigateur intégré reste à confirmer.

## Sources

- [Hub’Eau : qualité des nappes](https://hubeau.eaufrance.fr/page/api-qualite-nappes)
- [Description officielle sur data.gouv.fr](https://www.data.gouv.fr/dataservices/hubeau-qualite-des-nappes-deau-souterraine)
- [Swagger de l’API](https://hubeau.eaufrance.fr/api/v1/qualite_nappes/api-docs)
- [ADES](https://ades.eaufrance.fr/)
- [BDLISA](https://bdlisa.eaufrance.fr/)
- [Précision des coordonnées, nomenclature Sandre 916](https://id.eaufrance.fr/nsa/916)
- [Contours départementaux Etalab](https://etalab-datasets.geo.data.gouv.fr/contours-administratifs/2026/geojson/)
- [IGN](https://cartes.gouv.fr/), [Leaflet](https://leafletjs.com/), [Chart.js](https://www.chartjs.org/)
