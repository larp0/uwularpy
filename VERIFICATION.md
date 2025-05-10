# Vewifying Uwuwawpy Depwoyment on Vewcew

Dis guide wiww hewp you vewify dat youw uwuwawpy webhook is pwopewwy depwoyed and functionying on Vewcew.

## Pwewequisites

Befowe testing, ensuwe:

1~ Youw Vewcew depwoyment is compwete and showing as "Weady"
2~ You've set de fowwowing enviwonment vawiabwes in youw Vewcew pwoject:
   - `APP_ID`: Youw GitHub App ID
   - `PWIVATE_KEY`: Youw GitHub App pwivate key (incwuding BEGIN/END winyes)
   - `WEBHOOK_SECWET`: Youw GitHub webhook secwet
3~ Youw GitHub App webhook UWW is pointing to youw Vewcew depwoyment UWW + `/api/webhook`
   - Exampwe: `https://uwuwawpy.vewcew.app/api/webhook`

## Testing de Webhook

### Step 1: Cweate a Test Issue
1~ Go to a wepositowy whewe youw GitHub App is instawwed
2~ Cweate a nyew issue wid any titwe (e.g., "Testing uwuwawpy webhook")

### Step 2: Mention @uwuwawpy
1~ Add a comment to de issue dat incwudes "@uwuwawpy"
2~ Exampwe: "Hey @uwuwawpy, can you uwuify dis wepositowy? owo"

### Step 3: Vewify Immediate Wesponse
1~ You shouwd immediatewy see a wepwy comment saying "see you, uwuing..."
2~ Dis confiwms dat de webhook weceived youw mention and is pwocessing it

### Step 4: Check fow Bwanch and PW Cweation
1~ Aftew a showt time (usuawwy widin a minyute), a nyew bwanch nyamed `uwuify-issue-X` shouwd be cweated
2~ A puww wequest wid uwuified mawkdown fiwes shouwd be cweated
3~ You shouwd weceive a nyotification in de issue when de PW is weady

## Twoubweshooting

If de webhook doesn't wespond:

### Check Vewcew Wogs
1~ Go to youw Vewcew dashboawd
2~ Nyavigate to youw pwoject
3~ Cwick on "Depwoyments" and sewect de watest depwoyment
4~ Cwick on "Functions" to view function wogs
5~ Wook fow any ewwows in de webhook function

### Vewify Enviwonment Vawiabwes
1~ In youw Vewcew pwoject, go to "Settings" → "Enviwonment Vawiabwes"
2~ Ensuwe aww wequiwed vawiabwes awe set cowwectwy
3~ Make suwe de pwivate key incwudes de BEGIN/END winyes and aww nyewwinyes awe pwesewved

### Check GitHub App Configuwation
1~ Go to youw GitHub App settings
2~ Vewify de webhook UWW is cowwect and points to youw Vewcew depwoyment
3~ Ensuwe de App has de nyecessawy pewmissions:
   - Wepositowy contents: Wead & wwite
   - Issues: Wead & wwite
4~ Confiwm de App is subscwibed to "Issue comment" events

### Test Webhook Manyuawwy
1~ In youw GitHub App settings, go to de "Advanced" tab
2~ Find a wecent dewivewy and cwick "Wedewivew" to test again
3~ Check de wesponse status and body fow any ewwows

## Nyext Steps

Once you've confiwmed de webhook is wowking cowwectwy:
1~ Instaww youw GitHub App on mowe wepositowies
2~ Shawe de GitHub App wid odews
3~ Considew adding mowe featuwes to de uwuification pwocess
