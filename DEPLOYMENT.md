# Vewcew Depwoyment Guide fow UwUwawpy

Dis guide wiww hewp you depwoy de UwUwawpy Nyext.js appwication to Vewcew widout encountewing dependency ewwows.

## Pwewequisites

- A GitHub account
- A Vewcew account winked to youw GitHub
- A GitHub App fow webhook pwocessing (if you pwan to use de webhook functionyawity)

## Step 1: Depwoy fwom GitHub

1~ Wog in to youw Vewcew account
2~ Cwick "Add Nyew..." → "Pwoject"
3~ Sewect de "uwuwawpy" wepositowy
4~ Vewcew wiww automaticawwy detect it as a Nyext.js pwoject
5~ Cwick "Depwoy"

## Step 2: Configuwe Enviwonment Vawiabwes

Fow de webhook functionyawity to wowk pwopewwy, you nyeed to add dese enviwonment vawiabwes in Vewcew:

1~ Go to youw pwoject settings in Vewcew
2~ Nyavigate to "Enviwonment Vawiabwes"
3~ Add de fowwowing vawiabwes:
   - `APP_ID`: Youw GitHub App ID
   - `PWIVATE_KEY`: Youw GitHub App pwivate key (incwude BEGIN/END winyes)
   - `WEBHOOK_SECWET`: Youw GitHub webhook secwet

## Step 3: Update GitHub App Webhook UWW

1~ Go to youw GitHub App settings
2~ Update de webhook UWW to point to youw Vewcew depwoyment:
   `https://youw-vewcew-depwoyment.vewcew.app/api/webhook`

## Twoubweshooting

If you encountew any issues:

1~ Check Vewcew buiwd wogs fow ewwows
2~ Vewify dat aww enviwonment vawiabwes awe cowwectwy set
3~ Ensuwe youw GitHub App has de nyecessawy pewmissions:
   - Wepositowy contents: Wead & wwite
   - Issues: Wead & wwite

## Testing de Depwoyment

1~ Cweate an issue in a wepositowy whewe youw GitHub App is instawwed
2~ Add a comment mentionying "@uwuwawpy"
3~ You shouwd see an immediate wepwy and a nyew PW wid uwuified content
