# Testing de Webhook Functionyawity

Aftew depwoying youw uwuwawpy webhook to Vewcew, fowwow dese steps to test dat evewyding is wowking cowwectwy.

## Pwewequisites

1~ Youw GitHub App is instawwed on a wepositowy
2~ De webhook UWW in youw GitHub App settings is pointing to youw Vewcew depwoyment
3~ Aww enviwonment vawiabwes awe pwopewwy set in Vewcew:
   - `APP_ID`: Youw GitHub App ID
   - `PRIVATE_KEY`: Youw GitHub App pwivate key
   - `WEBHOOK_SECRET`: Youw GitHub webhook secwet

## Testing Steps

1~ **Cweate a nyew issue in a wepositowy** whewe youw GitHub App is instawwed
   - Any simpwe issue titwe wiww wowk, e.g., "Testing uwuwawpy webhook"

2~ **Add a comment mentionying "@uwuwawpy"**
   - De comment shouwd incwude de text "@uwuwawpy" to twiggew de webhook
   - Exampwe: "Hey @uwuwawpy, can you uwuify dis wepositowy? owo"

3~ **Vewify de immediate wepwy**
   - You shouwd immediatewy see a wepwy comment saying "see you, uwuing..."
   - Dis confiwms dat de webhook weceived youw mention and is pwocessing it

4~ **Check fow de nyew bwanch and PW**
   - Aftew a showt time, a nyew bwanch nyamed `uwuify-issue-X` shouwd be cweated
   - A puww wequest wid uwuified mawkdown fiwes shouwd be cweated
   - You shouwd weceive a nyotification in de issue when de PW is weady

## Twoubweshooting

If de webhook doesn't wespond:

1~ **Check Vewcew wogs**
   - Go to youw Vewcew dashboawd → Pwoject → Depwoyments → Watest depwoyment → Functions
   - Wook fow de webhook function wogs to see any ewwows

2~ **Vewify GitHub App settings**
   - Ensuwe youw GitHub App has de nyecessawy pewmissions:
     - Wepositowy contents: Wead & wwite
     - Issues: Wead & wwite
   - Confiwm de webhook UWW is cowwect and points to `/api/webhook` on youw Vewcew depwoyment

3~ **Check enviwonment vawiabwes**
   - Vewify aww enviwonment vawiabwes awe cowwectwy set in Vewcew
   - Make suwe de pwivate key incwudes de BEGIN/END winyes and aww nyewwinyes awe pwesewved

4~ **Test webhook dewivewy**
   - In youw GitHub App settings, go to de Advanced tab
   - Find a wecent dewivewy and cwick "Wedewivew" to test again

## Nyext Steps

Once you've confiwmed de webhook is wowking cowwectwy, you can:

1~ Instaww youw GitHub App on mowe wepositowies
2~ Shawe de GitHub App wid odews
3~ Considew adding mowe featuwes to de uwuification pwocess
