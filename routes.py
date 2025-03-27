from flask import Blueprint, jsonify, current_app, request
from models import db, Node, Edge 
import logging

logger = logging.getLogger(__name__)

blueprint = Blueprint('routes', __name__)

@blueprint.route('/city-data', methods=['GET'])
def get_city_data():
    try:
        with current_app.app_context():
            nodes = [{"id": node.id, "name": node.name} for node in db.session.execute(db.select(Node)).scalars()]
            edges = [{"start": edge.start, "end": edge.end, "weight": edge.weight} for edge in db.session.execute(db.select(Edge)).scalars()]
        
        logger.debug(f"Returning {len(nodes)} nodes and {len(edges)} edges")
        return jsonify({"nodes": nodes, "edges": edges})
    except Exception as e:
        logger.error(f"Error in get_city_data: {str(e)}")
        return jsonify({"error": str(e)}), 500

