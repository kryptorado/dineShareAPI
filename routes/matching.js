const express = require('express');

const router = express.Router();

router.get('/', async (req, res, next) => {
    /**
     * android client sends userid, interests
     * add user to some sort of queue ( as long as the user is on the 'find match screen', on mobile they're in the queue)
     * construct the following data format based on queue every few seconds:
        {
            "num_interests": <number of interests>,
            "<user_id>": [
                { "<interest_id>": <interest rating> },
                { "<interest_id>": <interest rating> }
            ],
            "<user_id>": [
                { "<interest_id>": <interest rating> },
                { "<interest_id>": <interest rating> }
            ]
        }
     
     * send data to dineShareMatching Flask server
     * scan returned matching list and when a match is found and those users are still in the queue,
     * construct a new channel id and token (TODO: add token server logic)
     * and return to the pair of users the generated data
 */

    return res.send("reached matching api path!")
});


module.exports = router;