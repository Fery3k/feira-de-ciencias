const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// CONFIGURAÇÃO DE UPLOAD DE IMAGENS (multer)
// ============================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'public')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const nome = 'img-upload-' + Date.now() + ext;
    cb(null, nome);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas arquivos JPG e PNG são permitidos.'));
  }
});

// Rota de upload de imagem
app.post('/api/upload-imagem', upload.single('imagem'), (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
  res.json({ sucesso: true, caminho: req.file.filename });
});

// Tratamento de erro do multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message) {
    return res.status(400).json({ erro: err.message });
  }
  next(err);
});

// ============================================================
// FUNÇÕES DE LEITURA/ESCRITA DO BANCO DE DADOS (data.json)
// ============================================================
function lerBanco() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao ler data.json:', err.message);
    return null;
  }
}

function salvarBanco(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Erro ao salvar data.json:', err.message);
    return false;
  }
}

// ============================================================
// API: OBTER TODOS OS DADOS (GET /api/dados)
// ============================================================
app.get('/api/dados', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro ao ler banco de dados' });
  res.json(db);
});

app.post('/api/dados', (req, res) => {
  const novosDados = req.body;
  if (!novosDados || typeof novosDados !== 'object') {
    return res.status(400).json({ erro: 'Dados inválidos fornecidos' });
  }
  if (salvarBanco(novosDados)) {
    res.json({ sucesso: true, dados: novosDados });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar dados no banco' });
  }
});

app.put('/api/dados', (req, res) => {
  const novosDados = req.body;
  if (!novosDados || typeof novosDados !== 'object') {
    return res.status(400).json({ erro: 'Dados inválidos fornecidos' });
  }
  if (salvarBanco(novosDados)) {
    res.json({ sucesso: true, dados: novosDados });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar dados no banco' });
  }
});

// ============================================================
// API: AUTENTICAÇÃO / LOGIN (POST /api/login)
// ============================================================
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const educador = db.educadores.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.senha === senha
  );

  if (educador) {
    res.json({ sucesso: true, educador });
  } else {
    res.status(401).json({ sucesso: false, erro: 'E-mail ou senha incorretos' });
  }
});

// ============================================================
// API: POSTAGENS
// ============================================================

// Listar todas
app.get('/api/postagens', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.postagens || []);
});

// Criar nova
app.post('/api/postagens', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const novoPost = {
    id: 'post-' + Date.now(),
    ...req.body
  };

  if (novoPost.destaque) {
    db.postagens.unshift(novoPost);
  } else {
    db.postagens.push(novoPost);
  }

  if (salvarBanco(db)) {
    res.status(201).json(novoPost);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar postagem' });
  }
});

// Atualizar existente
app.put('/api/postagens/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const index = db.postagens.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Postagem não encontrada' });

  db.postagens[index] = { ...db.postagens[index], ...req.body };

  if (salvarBanco(db)) {
    res.json(db.postagens[index]);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// Excluir
app.delete('/api/postagens/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  db.postagens = db.postagens.filter(p => p.id !== req.params.id);

  if (salvarBanco(db)) {
    res.json({ sucesso: true });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: EVENTOS DA SIDEBAR
// ============================================================
app.get('/api/eventos', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.eventosSidebar || []);
});

app.post('/api/eventos', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const novo = { id: 'evt-' + Date.now(), ...req.body };
  db.eventosSidebar.push(novo);

  if (salvarBanco(db)) {
    res.status(201).json(novo);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.put('/api/eventos/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const index = db.eventosSidebar.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Evento não encontrado' });

  db.eventosSidebar[index] = { id: req.params.id, ...req.body };

  if (salvarBanco(db)) {
    res.json(db.eventosSidebar[index]);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.delete('/api/eventos/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  db.eventosSidebar = db.eventosSidebar.filter(e => e.id !== req.params.id);

  if (salvarBanco(db)) {
    res.json({ sucesso: true });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: AVISOS DA SIDEBAR
// ============================================================
app.get('/api/avisos-sidebar', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.avisosSidebar || []);
});

app.post('/api/avisos-sidebar', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const novo = { id: 'aviso-' + Date.now(), ...req.body };
  db.avisosSidebar.push(novo);

  if (salvarBanco(db)) {
    res.status(201).json(novo);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.put('/api/avisos-sidebar/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const index = db.avisosSidebar.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Aviso não encontrado' });

  db.avisosSidebar[index] = { id: req.params.id, ...req.body };

  if (salvarBanco(db)) {
    res.json(db.avisosSidebar[index]);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.delete('/api/avisos-sidebar/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  db.avisosSidebar = db.avisosSidebar.filter(a => a.id !== req.params.id);

  if (salvarBanco(db)) {
    res.json({ sucesso: true });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: AVISOS ROLANTES (TICKER)
// ============================================================
app.get('/api/avisos', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.avisos || []);
});

app.post('/api/avisos', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const { texto } = req.body;
  if (!texto) return res.status(400).json({ erro: 'Texto do aviso é obrigatório' });

  db.avisos.push(texto);

  if (salvarBanco(db)) {
    res.status(201).json({ sucesso: true, avisos: db.avisos });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.delete('/api/avisos/:index', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const idx = parseInt(req.params.index, 10);
  if (isNaN(idx) || idx < 0 || idx >= db.avisos.length) {
    return res.status(400).json({ erro: 'Índice inválido' });
  }

  db.avisos.splice(idx, 1);

  if (salvarBanco(db)) {
    res.json({ sucesso: true, avisos: db.avisos });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: HORÁRIO DE AULAS
// ============================================================
app.get('/api/horario', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.horarioAulas || {});
});

app.put('/api/horario', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  db.horarioAulas = req.body;

  if (salvarBanco(db)) {
    res.json(db.horarioAulas);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: CARDÁPIO ESCOLAR
// ============================================================
app.get('/api/cardapio', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.cardapio || {});
});

app.put('/api/cardapio', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  db.cardapio = req.body;

  if (salvarBanco(db)) {
    res.json(db.cardapio);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: EDUCADORES
// ============================================================
app.get('/api/educadores', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.educadores || []);
});

app.post('/api/educadores', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const novo = { id: 'edu-' + Date.now(), ...req.body };
  db.educadores.push(novo);

  if (salvarBanco(db)) {
    res.status(201).json(novo);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.put('/api/educadores/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  const index = db.educadores.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Educador não encontrado' });

  db.educadores[index] = { id: req.params.id, ...req.body };

  if (salvarBanco(db)) {
    res.json(db.educadores[index]);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.delete('/api/educadores/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  if (db.educadores.length <= 1) {
    return res.status(400).json({ erro: 'Não é possível excluir a única conta de educador' });
  }

  db.educadores = db.educadores.filter(u => u.id !== req.params.id);

  if (salvarBanco(db)) {
    res.json({ sucesso: true });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// API: CURIOSIDADES
// ============================================================
app.get('/api/curiosidades', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });
  res.json(db.curiosidades || []);
});

app.post('/api/curiosidades', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  if (!db.curiosidades) db.curiosidades = [];
  const nova = { id: 'cur-' + Date.now(), ...req.body };
  db.curiosidades.push(nova);

  if (salvarBanco(db)) {
    res.status(201).json(nova);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.put('/api/curiosidades/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  if (!db.curiosidades) db.curiosidades = [];
  const index = db.curiosidades.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ erro: 'Curiosidade não encontrada' });

  db.curiosidades[index] = { id: req.params.id, ...req.body };

  if (salvarBanco(db)) {
    res.json(db.curiosidades[index]);
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

app.delete('/api/curiosidades/:id', (req, res) => {
  const db = lerBanco();
  if (!db) return res.status(500).json({ erro: 'Erro interno' });

  if (!db.curiosidades) db.curiosidades = [];
  db.curiosidades = db.curiosidades.filter(c => c.id !== req.params.id);

  if (salvarBanco(db)) {
    res.json({ sucesso: true });
  } else {
    res.status(500).json({ erro: 'Erro ao salvar' });
  }
});

// ============================================================
// ROTA: Painel Admin
// ============================================================
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ============================================================
// FALLBACK: Serve index.html para rotas não-API
// ============================================================
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// INICIAR SERVIDOR COM SUPORTE A REDE LOCAL & REMOTA
// ============================================================
function obterIpLocal() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ipLocal = obterIpLocal();
  console.log('\n============================================================');
  console.log('🚀 PORTAL ESCOLAR — SERVIDOR ATIVO & BANCO DE DADOS CONECTADO');
  console.log('============================================================');
  console.log(`💻 Acesso local neste computador:  http://localhost:${PORT}`);
  console.log(`📱 Acesso na rede local (Wi-Fi):   http://${ipLocal}:${PORT}`);
  console.log(`📁 Banco de Dados em disco:        ${DB_PATH}`);
  console.log(`📂 Pasta de arquivos públicos:     ${path.join(__dirname, 'public')}`);
  console.log('============================================================\n');
});
