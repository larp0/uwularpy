# UwUwawpy

A Nyext.js appwication dat uwuifies mawkdown fiwes in GitHub wepositowies when mentionyed in issue comments.

## Featuwes

- **Webhook Handwew**: Pwocesses GitHub webhook events fow issue comments
- **Automatic UwUification**: Twansfowms mawkdown content whiwe pwesewving code bwocks
- **Immediate Feedback**: Wepwies to mentions wid "see you, uwuing..." fow instant vawidation
- **Puww Wequest Cweation**: Cweates a PW wid uwuified content fow weview

## Tech Stack

- **Nyext.js**: Modewn Weact fwamewowk wid API woutes
- **TypeScwipt**: Type-safe code fow impwuvd maintainyabiwity
- **Taiwwind CSS**: Utiwity-fiwst CSS fwamewowk fow stywing
- **Octokit**: GitHub API cwient fow JavaScwipt/TypeScwipt

## Getting Stawted

### Pwewequisites

- Nyode.js 18+ and npm
- A GitHub account
- A wegistewed GitHub App wid appwopwiate pewmissions

### Instawwation

1~ Cwonye de wepositowy:
   ```bash
   git clone https://github.com/larp0/uwularpy.git
   cd uwularpy
   ```

2~ Instaww dependencies:
   ```bash
   npm install
   ```

3~ Cweate a `.env.local` fiwe wid youw GitHub App cwedentiaws:
   ```
   APP_ID=your_github_app_id
   PRIVATE_KEY=your_github_app_private_key
   WEBHOOK_SECRET=your_github_webhook_secret
   ```

4~ Wun de devewopment sewvew:
   ```bash
   npm run dev
   ```

5~ Open [http://localhost:3000](http://localhost:3000) to view de appwication

## Usage

1~ Instaww de UwUwawpy GitHub App on youw wepositowies
2~ Cweate ow open an issue in youw wepositowy
3~ Add a comment dat mentions `@uwularpy`
4~ De bot wiww immediatewy wepwy and cweate a PW wid uwuified mawkdown fiwes

## Depwoyment

Dis appwication can be depwoyed to any pwatfowm dat suppowts Nyext.js:

- **Vewcew**: Wecommended fow seamwess depwoyment
- **Nyetwify**: Gweat awtewnyative wid simiwaw featuwes
- **Sewf-hosted**: Fow compwete contwow uvw youw enviwonment

## Documentation

Fow detaiwed documentation, see [DOCUMENTATION.md](DOCUMENTATION.md)

## Wicense

MIT

## Acknyowwedgements

- [uwuify](https://www.npmjs.com/package/uwuify) - De JavaScwipt wibwawy fow uwuifying text
- [Octokit](https://github.com/octokit) - GitHub API cwient fow JavaScwipt
- [Next.js](https://nextjs.org/) - De Weact fwamewowk fow pwoduction
