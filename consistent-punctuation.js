var request = require("request@2.67.0");
var nodeRedis = require("redis@2.4.2");

function deducePunctuationPolicy(str) {
    if(str.endsWith("."))
        return "period";
    if(str.endsWith("!") || str.endsWith("?") || str.endsWith("..."))
        return "notsure";
    return "no-period";
}

module.exports = function(ctx, cb) {
    var redis = nodeRedis.createClient({
        host: "redis-16768.c12.us-east-1-4.ec2.cloud.redislabs.com",
        port: 16768,
        password: ctx.secrets.REDIS_PASSWORD
    });

    redis.auth(ctx.secrets.REDIS_PASSWORD, function(err, result) {
        if(err) return cb(err);
        onceRedisIsConnected(ctx, cb, redis);
    });
}

function onceRedisIsConnected(ctx, cb, redis) {
    var body = ctx.body;

    var repoKey = body.repository.id + ":recent-commit-messages";
    var commitsHistoryLength = 3;

    var commits = body.commits;
    redis.zrange([repoKey, 0, commitsHistoryLength-1], function(err, previousMessages) {
        if(err) return cb(err);

        var expectedPolicy = deducePunctuationPolicy(commits[0].message);
        var previousPolicies = previousMessages.map(prev => deducePunctuationPolicy(prev));
        if(previousMessages.length > 0) {
            expectedPolicy = mostFrequentElement(previousPolicies);
        }

        var violatingCommits = [];
        var addToHistory = [];
        for(var i = 0; i < commits.length; ++i) {
            var commit = commits[i];
            var commitPunctuationPolicy = deducePunctuationPolicy(commit.message);
            
            if(expectedPolicy == null || expectedPolicy == "notsure")
                expectedPolicy = commitPunctuationPolicy;
            
            if(commitPunctuationPolicy != "notsure") {
                if(commitPunctuationPolicy != expectedPolicy)
                    violatingCommits.push(commit);
                addToHistory.push(Date.parse(commit.timestamp))
                addToHistory.push(commit.message);
            }
        }

        addToHistory.unshift(repoKey);
        redis.zadd(addToHistory);
        if(previousMessages.length >= commitsHistoryLength) {
            redis.zscore([repoKey, previousMessages[1]], function(err, minScoreNoPrune) {
                redis.zremrangebyscore(repoKey, 0, minScoreNoPrune-1);
            })
        }

        if(violatingCommits.length == 0) {
            return cb(null, { message: "No inconsistency!" })
        }

        var emailContent = "Oh no! A punctuation inconsistency has been spotted in a commit on the " + body.repository.full_name + " repository.\n"
                         + "Here are the affected commit(s):\n\n";
        for(var i = 0; i < violatingCommits.length; ++i) {
            var commit = violatingCommits[i];
            emailContent += commit.url + "\n"
                          + "message \"" + commit.message + "\"\n"
                          + "hash " + commit.id + "\n"
                          + "author " + commit.author.username + "\n\n"
        }
        
        var recipient = ctx.query.mailto;
        request.post("https://api.mailgun.net/v3/mail.minikloon.net/messages")
            .auth("api", ctx.secrets.MAILGUN_KEY)
            .form({
                from: "The Consistency Police <mailgun@mail.minikloon.net>",
                to: recipient,
                subject: "📢 Commit Punctuation Inconsistency Alert!",
                text: emailContent
            }).on("response", function (res) {
                cb(null, {
                    message: "Inconsistency detected! Sent notification email to " + recipient, 
                    mailgun_status: { statusCode: res.statusCode, statusMessage: res.statusMessage }
                })
            }).on("error", function (e) {
                cb(e);
            })
    });
}

function mostFrequentElement(array) {
    if(array.length == 0)
        return null;
    var occurences = {};
    var mostFrequent = array[0], maxCount = 1;
    for(var i = 0; i < array.length; ++i)
    {
        var el = array[i];
        if(occurences[el] == null)
            occurences[el] = 1;
        else
            occurences[el]++;  

        if(occurences[el] > maxCount)
        {
            mostFrequent = el;
            maxCount = occurences[el];
        }
    }
    return mostFrequent;
}