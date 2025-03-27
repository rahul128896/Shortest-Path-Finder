from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import networkx as nx
import random
from routes import blueprint
import logging
from models import db, Node, Edge  

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates") 
CORS(app)  
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///city.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)  

app.register_blueprint(blueprint)

@app.route('/')
def index():
    return render_template('index.html')  

@app.route('/shortest-path', methods=['POST'])
def shortest_path():
    try:
        data = request.json
        logger.debug(f"Received data: {data}")
        
        start = int(data.get('start'))
        end = int(data.get('end'))
        
        logger.debug(f"Calculating shortest path from {start} to {end}")
        
        if start is None or end is None:
            return jsonify({"error": "Start and end nodes are required"}), 400
        
        G = nx.Graph()
        nodes = []
        edges = []
        
        with app.app_context():
            nodes = [node for node in db.session.execute(db.select(Node)).scalars()]
            edges = [edge for edge in db.session.execute(db.select(Edge)).scalars()]
        
        logger.debug(f"Found {len(nodes)} nodes and {len(edges)} edges")
        
        for node in nodes:
            G.add_node(node.id)
        
        for edge in edges:
            G.add_edge(edge.start, edge.end, weight=edge.weight)
            logger.debug(f"Added edge: {edge.start} -> {edge.end} (weight: {edge.weight})")
        
        logger.debug(f"Graph has {len(G.nodes)} nodes and {len(G.edges)} edges")
        
        if start not in G:
            logger.error(f"Start node {start} not in graph")
            return jsonify({"error": f"Start node {start} does not exist"}), 404
        
        if end not in G:
            logger.error(f"End node {end} not in graph")
            return jsonify({"error": f"End node {end} does not exist"}), 404
        
        try:
            path = nx.shortest_path(G, source=start, target=end, weight='weight')
            distance = nx.shortest_path_length(G, source=start, target=end, weight='weight')
            logger.debug(f"Found path: {path}, distance: {distance}")
            return jsonify({"path": path, "distance": distance})
        except nx.NetworkXNoPath:
            logger.error(f"No path exists between nodes {start} and {end}")
            return jsonify({"error": "No path exists between these nodes", "path": [], "distance": 0}), 200
        except Exception as e:
            logger.error(f"Error calculating path: {str(e)}")
            return jsonify({"error": str(e)}), 500
            
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({"error": str(e)}), 500

def init_db(app):
    with app.app_context():
        db.create_all()
        if not Node.query.first():
            for i in range(1, 16):
                db.session.add(Node(id=i, name=f'Node {i}'))
            db.session.commit()
            
            nodes = list(range(1, 16))
            connected = [1]  
            remaining = nodes[1:]
            
            while remaining:
                start = random.choice(connected)
                end = random.choice(remaining)
                weight = random.randint(1, 10)
                db.session.add(Edge(start=start, end=end, weight=weight))
                connected.append(end)
                remaining.remove(end)
            
            edges = set((e.start, e.end) for e in db.session.query(Edge).all())
            additional_edges = 10
            
            while len(edges) < len(nodes) + additional_edges:
                start, end = random.sample(range(1, 16), 2)
                if start != end and (start, end) not in edges and (end, start) not in edges:
                    weight = random.randint(1, 10)
                    db.session.add(Edge(start=start, end=end, weight=weight))
                    edges.add((start, end))
            
            db.session.commit()
            logger.info(f"Database initialized with {len(nodes)} nodes and {len(edges)} edges")

if __name__ == '__main__':
    init_db(app)  
    app.run(debug=True)

