const express = require('express');
const morgan = require('morgan');
const errorHandler = require('./middleware/error');

const app = express();
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
	app.use(morgan('dev'));
}

// Middleware
app.use(errorHandler);

// Route files
const matching = require('./routes/matching');

// Mount routers
app.use('/matching', matching);

app.listen(3000, console.log(`Server running on port 3000`));
