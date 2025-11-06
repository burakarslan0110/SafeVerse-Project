import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Modal,
} from 'react-native';
import { UserPlus, MapPin, User, Trash2, Navigation, Edit3 } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useFamilyContext } from '@/contexts/FamilyContext';
import ContactPicker from '@/components/ContactPicker';
import MeetingPointMap from '@/components/MeetingPointMap';
import { showAlert, showSimpleAlert } from '@/utils/platformHelpers';
import { formatPhoneNumber } from '@/lib/phoneFormatter';

export default function FamilyScreen() {
  const { colors } = useTheme();
  const { familyMembers, meetingPoint, addFamilyMember, removeFamilyMember, setMeetingPointLocation, isLoading } = useFamilyContext();
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  } | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return '#10B981';
      case 'danger':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'safe':
        return 'Güvende';
      case 'danger':
        return 'Tehlikede';
      default:
        return 'Bilinmiyor';
    }
  };

  const handleAddFamilyMember = async (contact: { name: string; phoneNumber: string }) => {
    try {
      await addFamilyMember({
        name: contact.name,
        phoneNumber: contact.phoneNumber,
        role: 'Aile Üyesi',
      });
    } catch (error) {
      console.error('Aile üyesi eklenirken hata:', error);
      const errorMessage = error instanceof Error ? error.message : 'Aile üyesi eklenirken bir hata oluştu.';
      showSimpleAlert('Hata', errorMessage);
    }
  };

  const handleDeleteMember = (id: string, name: string) => {
    showAlert(
      'Aile Üyesini Sil',
      `${name} adlı kişiyi aile üyelerinden çıkarmak istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => removeFamilyMember(id)
        }
      ]
    );
  };

  const handleConfirmLocation = async () => {
    if (!pendingLocation) return;

    try {
      await setMeetingPointLocation(
        pendingLocation.latitude,
        pendingLocation.longitude,
        pendingLocation.name,
        pendingLocation.address
      );
      setPendingLocation(null);
      setShowMapModal(false);
      showSimpleAlert('Başarılı', 'Toplanma alanı başarıyla kaydedildi!');
    } catch (error) {
      console.error('Error setting meeting point:', error);
      showSimpleAlert('Hata', 'Toplanma alanı kaydedilirken bir hata oluştu.');
    }
  };

  const handleCancelLocation = () => {
    setPendingLocation(null);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      backgroundColor: colors.cardBackground,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    section: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 8,
    },
    addButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '500',
    },
    memberItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    memberInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberDetails: {
      flex: 1,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    memberRole: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    phoneNumber: {
      fontSize: 12,
      marginTop: 2,
    },
    memberActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    deleteButton: {
      padding: 4,
    },
    loadingContainer: {
      padding: 20,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 14,
    },
    emptyContainer: {
      padding: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      textAlign: 'center',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '500',
      color: 'white',
    },
    meetingPointTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    meetingPointSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    meetingPointImage: {
      width: '100%',
      height: 192,
      borderRadius: 12,
      marginBottom: 16,
    },
    locationInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    locationDetails: {
      flex: 1,
    },
    locationName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    locationAddress: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    coordinateText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      fontStyle: 'italic',
    },
    editButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      gap: 6,
    },
    editButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '500',
    },
    mapModalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    mapModalContent: {
      flex: 1,
      backgroundColor: colors.background,
      marginTop: 50,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    mapModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    mapModalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    mapModalCloseButton: {
      padding: 8,
    },
    mapModalCloseText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    mapContainer: {
      height: 350,
      margin: 16,
      marginBottom: 8,
    },
    mapInfoBox: {
      margin: 16,
      marginTop: 0,
      padding: 16,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    mapInfoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 12,
    },
    mapInfoText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
      marginBottom: 8,
    },
    confirmCard: {
      margin: 16,
      marginTop: 0,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    confirmInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    confirmText: {
      flex: 1,
    },
    confirmTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 8,
      opacity: 0.7,
    },
    confirmName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    confirmAddress: {
      fontSize: 14,
      lineHeight: 20,
    },
    confirmButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    saveButton: {
      // backgroundColor set via inline style
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
    noLocationContainer: {
      alignItems: 'center',
      padding: 20,
      backgroundColor: colors.background,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    noLocationText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 16,
    },
    setLocationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8,
    },
    setLocationButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Aile Güvenliği</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aile Üyeleri</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowContactPicker(true)}
              testID="add-family-member-button"
            >
              <UserPlus size={16} color="white" />
              <Text style={styles.addButtonText}>Ekle</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
            </View>
          ) : familyMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz aile üyesi eklenmemiş.</Text>
            </View>
          ) : (
            familyMembers.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <View style={styles.memberInfo}>
                  {member.avatar ? (
                    <Image source={{ uri: member.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <User size={20} color="white" />
                    </View>
                  )}
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>{member.role || 'Aile Üyesi'}</Text>
                    <Text style={[styles.phoneNumber, { color: colors.textSecondary }]}>
                      {formatPhoneNumber(member.phoneNumber)}
                    </Text>
                  </View>
                </View>
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteMember(member.id, member.name)}
                    testID={`delete-member-${member.id}`}
                  >
                    <Trash2 size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.meetingPointTitle}>Aile Toplanma Alanı</Text>
            {meetingPoint && (
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setShowMapModal(true)}
              >
                <Edit3 size={14} color="white" />
                <Text style={styles.editButtonText}>Değiştir</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.meetingPointSubtitle}>
            Acil durumda buluşacağınız yer.
          </Text>

          {meetingPoint ? (
            <>
              <MeetingPointMap 
                selectedLocation={{
                  latitude: meetingPoint.latitude,
                  longitude: meetingPoint.longitude,
                  name: meetingPoint.name,
                  address: meetingPoint.address,
                }}
                height={200}
                onLocationSelect={undefined}
              />
              <View style={[styles.locationInfo, { marginTop: 20 }]}>
                <MapPin size={24} color={colors.primary} />
                <View style={styles.locationDetails}>
                  <Text style={styles.locationName}>{meetingPoint.name}</Text>
                  <Text style={styles.locationAddress}>{meetingPoint.address}</Text>
                  <Text style={styles.coordinateText}>
                    📍 {meetingPoint.latitude.toFixed(6)}, {meetingPoint.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.noLocationContainer}>
              <MapPin size={48} color={colors.textSecondary} />
              <Text style={styles.noLocationText}>
                Henüz toplanma alanı belirlenmemiş.{'\n'}
                Haritadan bir konum seçerek toplanma alanınızı belirleyin.
              </Text>
              <TouchableOpacity 
                style={styles.setLocationButton}
                onPress={() => setShowMapModal(true)}
              >
                <Navigation size={16} color="white" />
                <Text style={styles.setLocationButtonText}>Konum Seç</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      
      <ContactPicker
        visible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelectContact={handleAddFamilyMember}
      />

      <Modal
        visible={showMapModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPendingLocation(null);
          setShowMapModal(false);
        }}
      >
        <View style={styles.mapModalContainer}>
          <View style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <Text style={styles.mapModalTitle}>Toplanma Alanı Seç</Text>
              <TouchableOpacity
                style={styles.mapModalCloseButton}
                onPress={() => {
                  setPendingLocation(null);
                  setShowMapModal(false);
                }}
              >
                <Text style={styles.mapModalCloseText}>Kapat</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.mapContainer}>
              <MeetingPointMap
                selectedLocation={meetingPoint ? {
                  latitude: meetingPoint.latitude,
                  longitude: meetingPoint.longitude,
                  name: meetingPoint.name,
                  address: meetingPoint.address,
                } : null}
                onPendingLocationChange={setPendingLocation}
                showConfirmButton={false}
              />
            </View>

            {pendingLocation && (
              <View style={[styles.confirmCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.confirmInfo}>
                  <MapPin size={20} color={colors.primary} />
                  <View style={styles.confirmText}>
                    <Text style={[styles.confirmTitle, { color: colors.textPrimary }]}>
                      Seçilen Konum
                    </Text>
                    <Text style={[styles.confirmName, { color: colors.textPrimary }]}>
                      📍 {pendingLocation.name}
                    </Text>
                    <Text style={[styles.confirmAddress, { color: colors.textSecondary }]}>
                      {pendingLocation.address}
                    </Text>
                  </View>
                </View>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={handleCancelLocation}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.saveButton, { backgroundColor: colors.primary }]}
                    onPress={handleConfirmLocation}
                  >
                    <Text style={styles.saveButtonText}>Kaydet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.mapInfoBox}>
              <Text style={styles.mapInfoTitle}>ℹ️ Toplanma Alanı Hakkında</Text>
              <Text style={styles.mapInfoText}>
                • Belirlediğiniz toplanma alanının adı, enlem ve boylam bilgileri otomatik olarak kaydedilir.
              </Text>
              <Text style={styles.mapInfoText}>
                • "İyiyim" butonuna bastığınızda, konumunuzla birlikte toplanma alanı bilgisi de aile üyelerinize SMS ile iletilir.
              </Text>
              <Text style={styles.mapInfoText}>
                • Böylece herkes nerede toplanacağını ve sizin nerede olduğunuzu bilir.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
