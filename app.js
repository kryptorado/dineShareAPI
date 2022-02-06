const express = require('express');
const morgan = require('morgan');

const app = express();
if (process.env.NODE_ENV === 'development') {
	app.use(morgan('dev'));
}

// Route files
const matching = require('./routes/matching');

// Mount routers
app.use('/api/v1/matching', matching);

app.listen(8080, console.log(`Server running on port 8080`));
