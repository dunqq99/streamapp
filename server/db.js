const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stream_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDb() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to the MySQL database.');
    
    // Create categories
    await connection.query(`CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE
    )`);

    // Create articles
    await connection.query(`CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      tag VARCHAR(255),
      date VARCHAR(255),
      content TEXT,
      image_url VARCHAR(255),
      slug VARCHAR(255),
      category_slug VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    
    connection.release();
  } catch (err) {
    console.error('Error initializing MySQL database', err.message);
  }
}

initDb();

const repository = {
  // --- CATEGORIES ---
  getCategories: async () => {
    const [rows] = await pool.query(`SELECT * FROM categories ORDER BY id ASC`);
    return rows;
  },

  addCategory: async (name, slug) => {
    const [result] = await pool.query(`INSERT INTO categories (name, slug) VALUES (?, ?)`, [name, slug]);
    return result.insertId;
  },

  updateCategory: async (id, name, slug) => {
    const [result] = await pool.query(`UPDATE categories SET name = ?, slug = ? WHERE id = ?`, [name, slug, id]);
    return result.affectedRows;
  },

  deleteCategory: async (id) => {
    const [result] = await pool.query(`DELETE FROM categories WHERE id = ?`, [id]);
    return result.affectedRows;
  },

  // --- ARTICLES ---
  getArticles: async (categorySlug = null) => {
    let query = `SELECT * FROM articles ORDER BY created_at DESC`;
    let params = [];
    if (categorySlug) {
      query = `SELECT * FROM articles WHERE category_slug = ? ORDER BY created_at DESC`;
      params.push(categorySlug);
    }
    const [rows] = await pool.query(query, params);
    return rows;
  },

  getArticleBySlug: async (categorySlug, articleSlug) => {
    const [rows] = await pool.query(`SELECT * FROM articles WHERE category_slug = ? AND slug = ? LIMIT 1`, [categorySlug, articleSlug]);
    return rows.length > 0 ? rows[0] : undefined;
  },

  addArticle: async (article) => {
    const { title, tag, date, content, image_url, slug, category_slug } = article;
    const [result] = await pool.query(
      `INSERT INTO articles (title, tag, date, content, image_url, slug, category_slug) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, tag, date, content, image_url, slug, category_slug]
    );
    return result.insertId;
  },

  updateArticle: async (id, article) => {
    const { title, tag, date, content, image_url, slug, category_slug } = article;
    const [result] = await pool.query(
      `UPDATE articles SET title = ?, tag = ?, date = ?, content = ?, image_url = ?, slug = ?, category_slug = ? WHERE id = ?`,
      [title, tag, date, content, image_url, slug, category_slug, id]
    );
    return result.affectedRows;
  },

  deleteArticle: async (id) => {
    const [result] = await pool.query(`DELETE FROM articles WHERE id = ?`, [id]);
    return result.affectedRows;
  }
};

module.exports = repository;
