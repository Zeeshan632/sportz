import express from 'express';
import { matchesRouter } from './routes/matches.js';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello — Express server is running.' });
});

app.use('/matches', matchesRouter)

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
