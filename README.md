# Asset Description Auditor for Kontent.ai

This is a tool designed for [Kontent.ai](https://kontent.ai/) users who want to review and improve the quality of their asset metadata— specifically, the descriptions of their digital assets (like images, documents, and other files). You can try it out [here](https://asset-description-auditor.netlify.app/).

![Preview of the tool](asset-description-auditor-demo.gif)

## What does it do?

- **Connects to your Kontent.ai environment** using your Environment ID and Management API Key (with "Read assets" permission).
- **Fetches all assets** in your environment and displays them in a clear, filterable table.
- **Shows which assets are missing descriptions** in any of your project's languages, helping you spot gaps in your metadata.
- **Lets you filter by language** and see which assets are fully described, partially described, or missing descriptions.
- **Provides an overview** of description completeness for each language, including percentages and totals.
- **Allows you to export reports** (as Excel files) of both the overview and the detailed asset table, so you can share or work offline.
- **Lets you search and filter assets** by title or description, and paginate through large asset libraries.
- **Provides direct links to edit assets** in Kontent.ai, making it easy to update missing or incomplete descriptions.

## Who is it for?

- **Content managers** and **editors** who want to ensure all assets are properly described for localization, accessibility, or SEO.
- **Project owners** who need a quick audit of asset metadata completeness across multiple languages.
- **Anyone working with Kontent.ai** who wants to improve the quality and findability of their digital assets.

## How does it help?

- **Saves time:** No need to manually check each asset— see everything at a glance.
- **Improves quality:** Quickly identify and fix missing or incomplete descriptions.
- **Supports localization:** Ensure all assets are described in every required language.
- **Easy reporting:** Export results for team review or compliance.

## How to use it

### Option 1: Standalone Tool
1. **Enter your Kontent.ai Environment ID and Management API Key.**
2. Click **Get assets**.
3. Review the overview and asset table to see which assets are missing descriptions.
4. Use filters and search to focus on specific languages or assets.
5. Click the edit icon to jump directly to an asset in Kontent.ai.
6. Export reports as needed.

### Option 2: Kontent.ai Custom App
This tool can be deployed as a [Kontent.ai custom app](https://kontent.ai/learn/docs/custom-apps) for seamless integration into your Kontent.ai environment.

**Setup:**
1. Deploy this application to a web server (e.g., Netlify, Vercel, or your own hosting).
2. In Kontent.ai, navigate to **Environment settings** > **Custom apps**.
3. Click **Create new custom app**.
4. Enter a name for your app and the hosted URL.
5. Select which roles can access the app.
6. (Optional) Add your Management API Key in the **Parameters {JSON}** field:
   ```json
   {
     "managementApiKey": "your-api-key-here"
   }
   ```
7. Click **Save changes**.

**Usage:**
- The app will automatically detect your environment ID from the Kontent.ai context.
- If you provided your Management API key in the configuration, the app will work immediately.
- If no Management API key was provided, you'll need to enter it manually.
- All other functionality remains the same as the standalone version.

**Benefits of Custom App Mode:**
- **Seamless integration** into your Kontent.ai workflow
- **Automatic environment detection**- no need to enter your Environment ID
- **Role-based access control**- restrict access to specific user roles
- **Centralized configuration**- manage API keys through Kontent.ai settings
- **No external tool switching**- everything stays within Kontent.ai

---

**Note:** Your API key must have the "Read assets" permission. No asset data is stored— everything runs in your browser.

## Deploying

Netlify has made it easy to deploy and host this application. If you click the deploy button below, it will guide you through the process of deploying it to Netlify and leave you with a copy of the repository in your GitHub account as well.

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/mjstackhouse/asset-description-auditor)