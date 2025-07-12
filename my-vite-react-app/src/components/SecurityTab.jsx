import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  Divider,
  Alert,
  Chip
} from '@mui/material';
import {
  Security,
  Lock,
  PhoneAndroid,
  History,
  VpnKey,
  Warning
} from '@mui/icons-material';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { multiFactor } from 'firebase/auth';

const SecurityTab = ({ onOpenMFA }) => {
  const { currentUser } = useAuth();
  const [autoLogout, setAutoLogout] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  // Check if MFA is enabled
  const isMFAEnabled = currentUser && multiFactor(currentUser).enrolledFactors.length > 0;

  const securityFeatures = [
    {
      icon: <Lock />,
      title: 'Password Requirements',
      description: 'Strong password with uppercase, lowercase, numbers, and special characters',
      status: 'Enabled',
      statusColor: 'success',
      action: null
    },
    {
      icon: <PhoneAndroid />,
      title: 'Multi-Factor Authentication (MFA)',
      description: 'Add an extra layer of security with phone verification',
      status: isMFAEnabled ? 'Enabled' : 'Disabled',
      statusColor: isMFAEnabled ? 'success' : 'warning',
      action: (
        <Button 
          variant="outlined" 
          size="small" 
          onClick={onOpenMFA}
          color={isMFAEnabled ? 'primary' : 'warning'}
        >
          {isMFAEnabled ? 'Manage' : 'Enable'}
        </Button>
      )
    },
    {
      icon: <History />,
      title: 'Session Timeout',
      description: 'Automatic logout after 25 minutes of inactivity',
      status: 'Active',
      statusColor: 'success',
      action: (
        <Switch
          checked={autoLogout}
          onChange={(e) => setAutoLogout(e.target.checked)}
          color="primary"
        />
      )
    },
    {
      icon: <VpnKey />,
      title: 'Account Lockout',
      description: 'Account locks after 5 failed login attempts',
      status: 'Active',
      statusColor: 'success',
      action: null
    }
  ];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Security Settings
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        These security features help ensure HIPAA compliance and protect patient data.
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Security /> Account Security
          </Typography>
          
          <List>
            {securityFeatures.map((feature, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    {feature.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={feature.title}
                    secondary={feature.description}
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip 
                      label={feature.status} 
                      size="small" 
                      color={feature.statusColor}
                    />
                    {feature.action}
                  </ListItemSecondaryAction>
                </ListItem>
                {index < securityFeatures.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning /> Security Recommendations
          </Typography>
          
          <List>
            <ListItem>
              <ListItemText
                primary="Enable Multi-Factor Authentication"
                secondary="MFA significantly reduces the risk of unauthorized access"
                primaryTypographyProps={{ 
                  fontWeight: !isMFAEnabled ? 'bold' : 'normal',
                  color: !isMFAEnabled ? 'warning.main' : 'text.primary'
                }}
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Use a unique password"
                secondary="Don't reuse passwords from other applications"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Regular password updates"
                secondary="Change your password every 90 days for optimal security"
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Login notifications"
                secondary="Enable email alerts for new device logins"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={loginAlerts}
                  onChange={(e) => setLoginAlerts(e.target.checked)}
                  color="primary"
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <strong>HIPAA Compliance Note:</strong> All security features are designed to meet 
          HIPAA requirements for protecting electronic protected health information (ePHI). 
          Regular security audits and access logs are maintained for compliance purposes.
        </Typography>
      </Box>
    </Box>
  );
};

export default SecurityTab;