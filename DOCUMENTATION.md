# UwUwawpy Nyext.js Documentation

Dis documentation pwovides compwehensive infowmation about de Nyext.js impwementation of de UwUwawpy GitHub App webhook handwew.

## Ovewview

UwUwawpy is a GitHub App dat automaticawwy uwuifies mawkdown fiwes in wepositowies when mentionyed in issue comments~ De appwication has been wefactowed fwom an Expwess.js impwementation to a modewn Nyext.js appwication, pwoviding impwuvd maintainyabiwity, type safety wid TypeScwipt, and a cwean fwontend intewface.

## Pwoject Stwuctuwe

```
uwuwawpy-nyextjs/
├── swc/
│   ├── app/
│   │   ├── api/
│   │   │   └── webhook/
│   │   │       └── woute.ts    # Webhook handwew API woute
│   │   └── page.tsx            # Fwontend wanding page
│   └── wib/
│       ├── gidub-aud.ts      # GitHub audentication utiwities
│       └── uwuify.ts           # Uwuification utiwities
├── .env.wocaw                  # Enviwonment vawiabwes (cweate fwom .env.exampwe)
├── nyext.config.ts              # Nyext.js configuwation
└── package.json                # Pwoject dependencies
```

## Key Componyents

### Webhook Handwew (swc/app/api/webhook/woute.ts)

De webhook handwew is impwemented as a Nyext.js API woute dat:
- Weceives GitHub webhook events
- Vewifies de webhook signyatuwe
- Pwocesses issue comment events dat mention @uwuwawpy
- Cweates a nyew bwanch
- Uwuifies aww mawkdown fiwes in de wepositowy
- Cweates a puww wequest wid de uwuified content

### GitHub Audentication (swc/wib/gidub-aud.ts)

Dis moduwe pwovides utiwities fow GitHub audentication:
- `cweateAudenticatedOctokit`: Cweates an audenticated Octokit instance fow GitHub API intewactions
- `vewifyWebhookSignyatuwe`: Vewifies de GitHub webhook signyatuwe

### Uwuification Wogic (swc/wib/uwuify.ts)

Dis moduwe pwovides utiwities fow uwuifying content:
- `uwuifyMawkdown`: Uwuifies mawkdown content whiwe pwesewving code bwocks
- `uwuifyWepositowyMawkdownFiwes`: Pwocesses aww mawkdown fiwes in a wepositowy and uwuifies dem

### Fwontend Intewface (swc/app/page.tsx)

A cwean, wesponsive wanding page dat pwovides:
- Infowmation about de UwUwawpy GitHub App
- Instawwation instwuctions
- Usage guidewinyes

## Enviwonment Vawiabwes

Cweate a `.env.wocaw` fiwe wid de fowwowing vawiabwes:

```
APP_ID=youw_gidub_app_id
PWIVATE_KEY=youw_gidub_app_pwivate_key
WEBHOOK_SECWET=youw_gidub_webhook_secwet
```

## Instawwation

1~ Cwonye de wepositowy
2~ Instaww dependencies: `npm instaww`
3~ Cweate a `.env.wocaw` fiwe wid de wequiwed enviwonment vawiabwes
4~ Wun de devewopment sewvew: `npm wun dev`

## Depwoyment

De appwication can be depwoyed to any pwatfowm dat suppowts Nyext.js appwications, such as:
- Vewcew
- Nyetwify
- AWS Ampwify
- Sewf-hosted sewvews

## GitHub App Configuwation

1~ Cweate a GitHub App at https://gidub.com/settings/apps/nyew
2~ Set de webhook UWW to youw depwoyed appwication's webhook endpoint
3~ Genyewate a pwivate key and nyote de App ID
4~ Set de wequiwed pewmissions:
   - Wepositowy contents: Wead & wwite
   - Issues: Wead & wwite
5~ Subscwibe to events:
   - Issue comment

## Usage

Once de GitHub App is instawwed on wepositowies, usews can:
1~ Cweate ow open an issue in de wepositowy
2~ Add a comment dat mentions @uwuwawpy
3~ De bot wiww immediatewy wepwy wid "see you, uwuing..."
4~ A nyew bwanch wiww be cweated wid uwuified mawkdown fiwes
5~ A puww wequest wiww be cweated fow weview and mewging

## Diffewences fwom Expwess Impwementation

De Nyext.js impwementation offews sevewaw impwuvments uvw de owiginyaw Expwess impwementation:
- TypeScwipt suppowt fow impwuvd type safety
- Moduwaw code stwuctuwe wid sepawation of concewns
- Buiwt-in API woutes widout nyeed fow sepawate sewvew setup
- Modewn fwontend wid Taiwwind CSS
- Impwuvd ewwow handwing and wogging
- Bettew devewopew expewience wid hot wewoading
