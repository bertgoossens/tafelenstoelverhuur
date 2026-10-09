# Tafel & Stoel — website + bestelformulier

Website voor tafel- en stoelverhuur in Wechelderzande. Eén Node/Express-server serveert de
site (`public/`) en mailt bestelaanvragen via [Resend](https://resend.com).

## Lokaal draaien

Vereist Node 18 of hoger (`nvm use` kiest Node 20).

```bash
npm install
npm start      # http://localhost:3000
npm test
```

## Bestelformulier

Het formulier stuurt aanvragen naar `POST /api/bestelling`, dat ze mailt via Resend.
Zet daarvoor op Render:

- `RESEND_API_KEY` = je Resend API-sleutel
- `ORDER_TO` (optioneel) = ontvanger, standaard `info@bertgoossens.be`
- `ORDER_FROM` (optioneel) = afzender, standaard `Tafel & Stoel <website@tafelenstoelverhuur.be>`
  (het domein moet geverifieerd zijn in Resend)

Zonder `RESEND_API_KEY`, of als Resend een fout geeft, valt het formulier terug op een
mailto-link, zodat er nooit een aanvraag verloren gaat.

## Render

Web Service (Node): build command `npm install`, start command `npm start`.
Prijzen, voorraad en contactgegevens staan bovenaan het script in `public/index.html` (blok `CONFIG`).
