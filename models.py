from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Node(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

class Edge(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    start = db.Column(db.Integer, db.ForeignKey('node.id'), nullable=False)
    end = db.Column(db.Integer, db.ForeignKey('node.id'), nullable=False)
    weight = db.Column(db.Integer, nullable=False)
