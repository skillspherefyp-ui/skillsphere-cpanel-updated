import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import StudentDashboard from '../screens/student/StudentDashboard';
import BrowseCoursesScreen from '../screens/student/BrowseCoursesScreen';
import CourseDetailScreen from '../screens/student/CourseDetailScreen';
import LearningScreen from '../screens/student/LearningScreen';
import AILearningScreen from '../screens/student/AILearningScreen';
import AIVirtualClassroomScreen from '../screens/student/AIVirtualClassroomScreen';
import QuizScreen from '../screens/student/QuizScreen';
import QuizResultScreen from '../screens/student/QuizResultScreen';
import AIChatScreen from '../screens/student/AIChatScreen';
import CertificatesScreen from '../screens/student/CertificatesScreen';
import NotificationsScreen from '../screens/auth/NotificationsScreen';
import NotificationDetailScreen from '../screens/auth/NotificationDetailScreen';
import TodoScreen from '../screens/student/TodoScreen';
import PaymentScreen from '../screens/student/PaymentScreen';
import CertificatePreviewScreen from '../screens/student/CertificatePreviewScreen';
import ProgressDetailScreen from '../screens/student/ProgressDetailScreen';
import CategoriesScreen from '../screens/student/CategoriesScreen';
import EnrolledCoursesScreen from '../screens/student/EnrolledCoursesScreen';
import SettingsScreen from '../screens/auth/SettingsScreen';
import DiscussionScreen from '../screens/auth/DiscussionScreen';
import DiscussionThreadScreen from '../screens/auth/DiscussionThreadScreen';
import BlogScreen from '../screens/static/BlogScreen';
import BlogPostScreen from '../screens/static/BlogPostScreen';
import CertificateVerificationScreen from '../screens/auth/CertificateVerificationScreen';
import OwnershipScreen from '../screens/static/OwnershipScreen';
import RefundPolicyScreen from '../screens/static/RefundPolicyScreen';
import AILearningProfileScreen from '../screens/student/AILearningProfileScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import CourseFeedbackScreen from '../screens/student/CourseFeedbackScreen';

const Stack = createStackNavigator();

const StudentNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Dashboard" component={StudentDashboard} />
      <Stack.Screen name="Courses" component={BrowseCoursesScreen} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
      <Stack.Screen name="Learning" component={LearningScreen} />
      <Stack.Screen name="AILearning" component={AILearningScreen} />
      <Stack.Screen name="AIVirtualClassroom" component={AIVirtualClassroomScreen} />
      <Stack.Screen name="Quiz" component={QuizScreen} />
      <Stack.Screen name="QuizResult" component={QuizResultScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} />
      <Stack.Screen name="Todo" component={TodoScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="ProgressDetail" component={ProgressDetailScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="EnrolledCourses" component={EnrolledCoursesScreen} />
      <Stack.Screen name="AITutor" component={AIChatScreen} />
      <Stack.Screen name="Certificates" component={CertificatesScreen} />
      <Stack.Screen name="CertificatePreview" component={CertificatePreviewScreen} />
      <Stack.Screen name="CourseFeedback" component={CourseFeedbackScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Discussion" component={DiscussionScreen} />
      <Stack.Screen name="DiscussionThread" component={DiscussionThreadScreen} />
      <Stack.Screen name="Blog" component={BlogScreen} />
      <Stack.Screen name="BlogPost" component={BlogPostScreen} />
      <Stack.Screen name="CertificateVerify" component={CertificateVerificationScreen} />
      <Stack.Screen name="Verify" component={CertificateVerificationScreen} />
      <Stack.Screen name="AILearningProfile" component={AILearningProfileScreen} />
      <Stack.Screen name="Ownership" component={OwnershipScreen} />
      <Stack.Screen name="RefundPolicy" component={RefundPolicyScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
    </Stack.Navigator>
  );
};

export default StudentNavigator;
