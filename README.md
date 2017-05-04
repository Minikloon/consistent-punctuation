### consistent-punctuation

![email alert](http://i.imgur.com/ekpyN05.png)

This is a simple service intended to be used as a Github webhook. 
It will send an email if a commit is pushed with inconsistent punctuation.

* Hosting on https://webtask.io
* Emails by https://www.mailgun.com
* Redis from https://redislabs.com

### Usage

**Step 1**

Create a webhook on Github on your favorite repository.

![where are webhooks](http://i.imgur.com/Q7TYmaJ.png)

Fill in the **Payload URL** field with this webhook:

`https://<span></span>wt-d878134b7b657e0e65e15239acb0466e-0.run.webtask.io/consistent-punctuation?mailto=YOUR_EMAIL`

Make sure to replace YOUR_EMAIL in the link.

**Step 2**

Stir up chaos in the world by creating commit messages with inconsistent punctuation.

![utter chaos](http://i.imgur.com/1Icwd8q.png)

**Step 3**

Get alerted of your (or someone else's) mischiefs.

![an email alert](http://i.imgur.com/QkTpOH1.png)
