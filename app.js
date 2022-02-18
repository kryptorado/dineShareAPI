const express = require('express');
const morgan = require('morgan');
const errorHandler = require('./middleware/error');

const app = express();
if (process.env.NODE_ENV === 'development') {
	app.use(morgan('dev'));
}

// Middleware
app.use(errorHandler);

// Route files
const matching = require('./routes/matching');

// Mount routers
app.use('/api/v1/matching', matching);

app.listen(8080, console.log(`Server running on port 8080`));
