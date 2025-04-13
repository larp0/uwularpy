import React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">UwUlarpy</h1>
        </div>
      </header>
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
              <h2 className="text-2xl font-semibold mb-4">GitHub Webhook Handler for UwUifying Repositories</h2>
              
              <div className="mb-6">
                <p className="mb-2">UwUlarpy is a GitHub App that automatically uwuifies markdown files in your repository when mentioned in an issue comment.</p>
                <p className="mb-2">Simply mention <code className="bg-gray-200 px-1 rounded">@uwularpy</code> in any issue comment, and the bot will:</p>
                <ol className="list-decimal list-inside ml-4 space-y-1">
                  <li>Immediately reply with "see you, uwuing..."</li>
                  <li>Create a new branch from main</li>
                  <li>UwUify all markdown files in the repository</li>
                  <li>Create a pull request with the uwuified content</li>
                </ol>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-medium text-blue-800 mb-2">Installation</h3>
                <p className="text-blue-700">To install UwUlarpy on your repositories:</p>
                <ol className="list-decimal list-inside ml-4 text-blue-700 space-y-1">
                  <li>Go to the <a href="https://github.com/apps/uwularpy" className="text-blue-600 underline">UwUlarpy GitHub App</a></li>
                  <li>Click "Install"</li>
                  <li>Select the repositories you want to enable UwUlarpy on</li>
                </ol>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-green-800 mb-2">Usage</h3>
                <p className="text-green-700">Once installed, using UwUlarpy is simple:</p>
                <ol className="list-decimal list-inside ml-4 text-green-700 space-y-1">
                  <li>Create or open an issue in your repository</li>
                  <li>Add a comment that includes <code className="bg-gray-200 px-1 rounded">@uwularpy</code></li>
                  <li>Wait for the bot to respond and create a pull request</li>
                  <li>Review and merge the pull request to uwuify your markdown files</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-6 px-4 overflow-hidden sm:px-6 lg:px-8">
          <p className="text-center text-gray-500">
            UwUlarpy - A Next.js application for uwuifying GitHub repositories
          </p>
        </div>
      </footer>
    </div>
  );
}
