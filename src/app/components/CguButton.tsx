import { useNavigate } from 'react-router-dom';

const cgu_button = () => {
  const navigate = useNavigate();

  return (
    <span
      onClick={() => navigate('/cgu')}
      style={{
        color: '#007bff',
        textDecoration: 'underline',
        cursor: 'pointer',
      }}
    >
      Clique ici pour ouvrir la nouvelle page
    </span>
  );
};

export default cgu_button;
