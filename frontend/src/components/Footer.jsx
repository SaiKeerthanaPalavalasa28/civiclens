import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Link to="/" className="footer-logo">CivicLens</Link>
          <p className="footer-tagline">Designed for simple and structured policy analysis.</p>
        </div>
        <div className="footer-col">
          <h4>Navigate</h4>
          <ul>
            <li><a href="/#home">Home</a></li>
            <li><a href="/#about">About</a></li>
            <li><a href="/#how">How It Works</a></li>
            <li><a href="/#features">Features</a></li>
            <li><a href="/#team">Team</a></li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Project</h4>
          <ul>
            <li><a href="#">GitHub Repository</a></li>
            <li><a href="#">Project Report</a></li>
            <li><a href="#">Presentation Slides</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>CivicLens Academic Project | 2026</span>
        <span>Designed for simple and structured policy analysis</span>
      </div>
    </footer>
  );
};

export default Footer;
