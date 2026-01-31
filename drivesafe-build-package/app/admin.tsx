import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Camera {
  id: string;
  latitude: number;
  longitude: number;
  camera_type: string;
  road_name?: string;
  speed_limit?: number;
  confidence: number;
  is_active: boolean;
}

interface AppSettings {
  mobile_camera_ttl_minutes: number;
  police_check_ttl_minutes: number;
  duplicate_radius_meters: number;
  rate_limit_minutes: number;
}

export default function AdminScreen() {
  const router = useRouter();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'cameras' | 'settings' | 'import'>('cameras');
  const [settings, setSettings] = useState<AppSettings>({
    mobile_camera_ttl_minutes: 75,
    police_check_ttl_minutes: 52,
    duplicate_radius_meters: 200,
    rate_limit_minutes: 5,
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamera, setNewCamera] = useState({
    latitude: '',
    longitude: '',
    camera_type: 'fixed',
    road_name: '',
    speed_limit: '',
  });
  const [importData, setImportData] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [camerasRes, settingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/cameras/all`),
        axios.get(`${API_URL}/api/settings`),
      ]);
      setCameras(camerasRes.data || []);
      if (settingsRes.data) {
        setSettings(settingsRes.data);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
    setIsLoading(false);
  };

  const handleAddCamera = async () => {
    try {
      const lat = parseFloat(newCamera.latitude);
      const lon = parseFloat(newCamera.longitude);
      
      if (isNaN(lat) || isNaN(lon)) {
        Alert.alert('Error', 'Invalid coordinates');
        return;
      }

      await axios.post(`${API_URL}/api/cameras`, {
        latitude: lat,
        longitude: lon,
        camera_type: newCamera.camera_type,
        road_name: newCamera.road_name || null,
        speed_limit: newCamera.speed_limit ? parseInt(newCamera.speed_limit) : null,
      });

      setShowAddModal(false);
      setNewCamera({
        latitude: '',
        longitude: '',
        camera_type: 'fixed',
        road_name: '',
        speed_limit: '',
      });
      fetchData();
      Alert.alert('Success', 'Camera added successfully');
    } catch (error) {
      console.error('Add error:', error);
      Alert.alert('Error', 'Failed to add camera');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.post(`${API_URL}/api/settings`, settings);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      console.error('Settings error:', error);
      Alert.alert('Error', 'Failed to save settings');
    }
  };

  const handleImportJSON = async () => {
    try {
      const data = JSON.parse(importData);
      if (!Array.isArray(data)) {
        Alert.alert('Error', 'Data must be an array of cameras');
        return;
      }

      let imported = 0;
      for (const cam of data) {
        if (cam.latitude && cam.longitude && cam.camera_type) {
          await axios.post(`${API_URL}/api/cameras`, cam);
          imported++;
        }
      }

      setImportData('');
      fetchData();
      Alert.alert('Success', `Imported ${imported} cameras`);
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Error', 'Invalid JSON format');
    }
  };

  const handleSeedData = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/seed`);
      fetchData();
      Alert.alert('Success', response.data.message);
    } catch (error) {
      console.error('Seed error:', error);
      Alert.alert('Error', 'Failed to seed data');
    }
  };

  const getCameraTypeColor = (type: string) => {
    switch (type) {
      case 'fixed': return '#ef4444';
      case 'average_speed_start': return '#f97316';
      case 'average_speed_end': return '#eab308';
      case 'red_light': return '#a855f7';
      default: return '#64748b';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['cameras', 'settings', 'import'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cameras Tab */}
      {activeTab === 'cameras' && (
        <View style={styles.tabContent}>
          <View style={styles.statsBar}>
            <Text style={styles.statsText}>{cameras.length} cameras in database</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.camerasList}>
            {cameras.map((camera) => (
              <View key={camera.id} style={styles.cameraItem}>
                <View style={[
                  styles.cameraType,
                  { backgroundColor: getCameraTypeColor(camera.camera_type) }
                ]}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
                <View style={styles.cameraInfo}>
                  <Text style={styles.cameraName}>
                    {camera.road_name || 'Unknown Road'}
                  </Text>
                  <Text style={styles.cameraDetails}>
                    {camera.camera_type.replace('_', ' ')} • 
                    {camera.speed_limit ? ` ${camera.speed_limit} mph` : ' No limit'}
                  </Text>
                  <Text style={styles.cameraCoords}>
                    {camera.latitude.toFixed(4)}, {camera.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  camera.is_active ? styles.statusActive : styles.statusInactive
                ]}>
                  <Text style={styles.statusText}>
                    {camera.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <ScrollView style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Report TTL Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Mobile Camera TTL (minutes)</Text>
            <TextInput
              style={styles.settingInput}
              value={String(settings.mobile_camera_ttl_minutes)}
              onChangeText={(v) => setSettings({...settings, mobile_camera_ttl_minutes: parseInt(v) || 0})}
              keyboardType="number-pad"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Police Check TTL (minutes)</Text>
            <TextInput
              style={styles.settingInput}
              value={String(settings.police_check_ttl_minutes)}
              onChangeText={(v) => setSettings({...settings, police_check_ttl_minutes: parseInt(v) || 0})}
              keyboardType="number-pad"
              placeholderTextColor="#64748b"
            />
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Anti-Spam Settings</Text>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Duplicate Radius (meters)</Text>
            <TextInput
              style={styles.settingInput}
              value={String(settings.duplicate_radius_meters)}
              onChangeText={(v) => setSettings({...settings, duplicate_radius_meters: parseInt(v) || 0})}
              keyboardType="number-pad"
              placeholderTextColor="#64748b"
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Rate Limit (minutes)</Text>
            <TextInput
              style={styles.settingInput}
              value={String(settings.rate_limit_minutes)}
              onChangeText={(v) => setSettings({...settings, rate_limit_minutes: parseInt(v) || 0})}
              keyboardType="number-pad"
              placeholderTextColor="#64748b"
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
            <Ionicons name="save" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Save Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <ScrollView style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Import Camera Data</Text>
          <Text style={styles.importDescription}>
            Paste JSON array of cameras. Each camera needs: latitude, longitude, camera_type.
            Optional: road_name, speed_limit.
          </Text>

          <TextInput
            style={styles.importInput}
            value={importData}
            onChangeText={setImportData}
            placeholder='[{"latitude": 51.5, "longitude": -0.1, "camera_type": "fixed", "road_name": "A1", "speed_limit": 30}]'
            placeholderTextColor="#475569"
            multiline
            numberOfLines={8}
          />

          <TouchableOpacity style={styles.importBtn} onPress={handleImportJSON}>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.importBtnText}>Import JSON</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Sample Data</Text>
          <Text style={styles.importDescription}>
            Load sample UK speed camera data for testing.
          </Text>

          <TouchableOpacity style={styles.seedBtn} onPress={handleSeedData}>
            <Ionicons name="refresh" size={20} color="#f97316" />
            <Text style={styles.seedBtnText}>Seed Sample Data (20 cameras)</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Add Camera Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Camera</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Latitude *</Text>
              <TextInput
                style={styles.modalInput}
                value={newCamera.latitude}
                onChangeText={(v) => setNewCamera({...newCamera, latitude: v})}
                placeholder="51.5074"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Longitude *</Text>
              <TextInput
                style={styles.modalInput}
                value={newCamera.longitude}
                onChangeText={(v) => setNewCamera({...newCamera, longitude: v})}
                placeholder="-0.1278"
                placeholderTextColor="#64748b"
                keyboardType="decimal-pad"
              />

              <Text style={styles.inputLabel}>Camera Type *</Text>
              <View style={styles.typeSelector}>
                {['fixed', 'average_speed_start', 'average_speed_end', 'red_light'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeOption,
                      newCamera.camera_type === type && styles.typeOptionActive,
                    ]}
                    onPress={() => setNewCamera({...newCamera, camera_type: type})}
                  >
                    <Text style={[
                      styles.typeOptionText,
                      newCamera.camera_type === type && styles.typeOptionTextActive,
                    ]}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Road Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newCamera.road_name}
                onChangeText={(v) => setNewCamera({...newCamera, road_name: v})}
                placeholder="A1 North Circular"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.inputLabel}>Speed Limit (mph)</Text>
              <TextInput
                style={styles.modalInput}
                value={newCamera.speed_limit}
                onChangeText={(v) => setNewCamera({...newCamera, speed_limit: v})}
                placeholder="30"
                placeholderTextColor="#64748b"
                keyboardType="number-pad"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddCamera}>
                <Text style={styles.submitBtnText}>Add Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#3b82f6',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  camerasList: {
    flex: 1,
  },
  cameraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cameraType: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cameraName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cameraDetails: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  cameraCoords: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusActive: {
    backgroundColor: '#052e16',
  },
  statusInactive: {
    backgroundColor: '#450a0a',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22c55e',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingItem: {
    marginBottom: 16,
  },
  settingLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  settingInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  importDescription: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 20,
  },
  importInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 16,
  },
  importBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 24,
  },
  seedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f97316',
  },
  seedBtnText: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  typeOptionActive: {
    backgroundColor: '#3b82f6',
  },
  typeOptionText: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  typeOptionTextActive: {
    color: '#fff',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
